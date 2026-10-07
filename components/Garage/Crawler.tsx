"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The player's RC crawler — a white Jeep-style hard body on a lifted
 * four-link chassis, built to match the reference photo of Radhev's own
 * truck.
 *
 * It is modelled from primitives rather than loaded as a glTF on purpose:
 * the whole vehicle costs a few kilobytes of code instead of a few megabytes
 * of mesh, which matters when the brief is that the portfolio stays light.
 * The silhouette is what makes it readable — seven-slot grille, round
 * headlights, square shoulders, flat roof, enormous tyres under tight
 * flares — so the detail budget goes there rather than into polygon count.
 *
 * Forward is −Z. Wheel centres sit at y = 0, so the tyres put the ground at
 * y = −TYRE_R and everything else is placed from the axle line.
 */

export const TYRE_R = 0.26;
export const TRACK = 0.38;
export const WHEELBASE = 0.55;

/** Front-left, front-right, rear-left, rear-right. */
export const WHEEL_ANCHORS: [number, number, number][] = [
  [-TRACK, 0, -WHEELBASE],
  [TRACK, 0, -WHEELBASE],
  [-TRACK, 0, WHEELBASE],
  [TRACK, 0, WHEELBASE],
];

/**
 * Handles the driving code needs on the model: the four wheel carriers (which
 * steer and travel), the four hubs (which spin), the four shock shafts (which
 * compress) and the shell (which rolls and pitches).
 */
export type CrawlerRig = {
  wheels: (THREE.Group | null)[];
  hubs: (THREE.Group | null)[];
  shocks: (THREE.Object3D | null)[];
  shell: THREE.Group | null;
};

export function emptyRig(): CrawlerRig {
  return { wheels: [], hubs: [], shocks: [], shell: null };
}

/* ── Materials ──────────────────────────────────────────────── */

// Created once and shared by every instance. Two crawlers exist at most (the
// one being driven and the one on the display plinth), and neither outlives
// the scene, so there is nothing to dispose.
const M = {
  shell: new THREE.MeshStandardMaterial({ color: "#f2f2f0", roughness: 0.32, metalness: 0.04 }),
  trim: new THREE.MeshStandardMaterial({ color: "#121214", roughness: 0.55, metalness: 0.15 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#131315", roughness: 0.95 }),
  rim: new THREE.MeshStandardMaterial({ color: "#1b1b1e", roughness: 0.5, metalness: 0.45 }),
  metal: new THREE.MeshStandardMaterial({ color: "#5a5a60", roughness: 0.35, metalness: 0.85 }),
  spring: new THREE.MeshStandardMaterial({ color: "#2a2a2e", roughness: 0.4, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({
    color: "#0d1116",
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.78,
  }),
  accent: new THREE.MeshStandardMaterial({ color: "#f4441a", roughness: 0.38, metalness: 0.05 }),
  lamp: new THREE.MeshStandardMaterial({
    color: "#fff6e2",
    emissive: "#ffe9c4",
    emissiveIntensity: 1.6,
    roughness: 0.2,
  }),
  tail: new THREE.MeshStandardMaterial({
    color: "#c8201a",
    emissive: "#ff2a16",
    emissiveIntensity: 0.9,
    roughness: 0.35,
  }),
};

/* ── Tyre ───────────────────────────────────────────────────── */

/**
 * One merged geometry for the whole tyre. The tread is 18 staggered pairs of
 * lugs plus a row of shoulder blocks — built as separate boxes and merged, so
 * an aggressive-looking tyre is still a single draw call.
 */
function useTyreGeometry() {
  return useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];

    const carcass = new THREE.CylinderGeometry(TYRE_R - 0.03, TYRE_R - 0.03, 0.2, 22, 1);
    carcass.rotateZ(Math.PI / 2);
    parts.push(carcass);

    const LUGS = 18;
    for (let i = 0; i < LUGS; i++) {
      const a = (i / LUGS) * Math.PI * 2;

      // Two staggered inner rows, offset half a step from each other.
      for (const x of [-0.05, 0.05]) {
        const stagger = x < 0 ? 0 : Math.PI / LUGS;
        const g = new THREE.BoxGeometry(0.086, 0.036, 0.08);
        g.translate(0, TYRE_R - 0.042, 0);
        g.rotateX(a + stagger);
        g.translate(x, 0, 0);
        parts.push(g);
      }

      // Shoulder blocks, which are what read as "knobby" from the side.
      for (const x of [-0.108, 0.108]) {
        const g = new THREE.BoxGeometry(0.05, 0.05, 0.07);
        g.translate(0, TYRE_R - 0.05, 0);
        g.rotateX(a + Math.PI / LUGS / 2);
        g.translate(x, 0, 0);
        parts.push(g);
      }
    }

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged!;
  }, []);
}

/** Beadlock-style rim: barrel, two rings and six spokes. */
function Rim() {
  return (
    <group>
      <mesh material={M.rim} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.2, 18]} />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} material={M.trim} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.155, 0.016, 6, 20]} />
        </mesh>
      ))}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            material={M.rim}
            position={[0, Math.cos(a) * 0.09, Math.sin(a) * 0.09]}
            rotation={[a, 0, 0]}
          >
            <boxGeometry args={[0.21, 0.07, 0.05]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Wheel({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* The tyre is rotated back out of the rim's frame so its axis is X. */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh geometry={geometry} material={M.rubber} castShadow />
      </group>
      <group rotation={[0, 0, -Math.PI / 2]}>
        <Rim />
      </group>
    </group>
  );
}

/* ── Decal ──────────────────────────────────────────────────── */

/** The RUBICON bonnet graphic, drawn to a canvas rather than shipped as a file. */
function useDecal() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = "#d4321a";
    ctx.font = "bold 44px 'Arial Narrow', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RUBICON", 128, 36);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }, []);
}

/* ── The vehicle ────────────────────────────────────────────── */

export function Crawler({ rig }: { rig?: React.RefObject<CrawlerRig> }) {
  const tyre = useTyreGeometry();
  const decal = useDecal();

  const hold = <K extends "wheels" | "hubs" | "shocks">(key: K, i: number) =>
    rig
      ? (el: THREE.Group | null) => {
          rig.current[key][i] = el;
        }
      : undefined;

  return (
    <group>
      {/* ── Running gear ─────────────────────────────────── */}
      <group>
        {/* Ladder frame */}
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} material={M.metal} position={[x, -0.02, 0.01]} castShadow>
            <boxGeometry args={[0.06, 0.06, 1.56]} />
          </mesh>
        ))}

        {/* Solid axles with a diff pumpkin offset to one side, as a live axle has */}
        {[-WHEELBASE, WHEELBASE].map((z) => (
          <group key={z} position={[0, -0.02, z]}>
            <mesh material={M.metal} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.042, 0.042, 0.74, 10]} />
            </mesh>
            <mesh material={M.metal} position={[-0.1, 0, 0]} castShadow>
              <sphereGeometry args={[0.095, 12, 10]} />
            </mesh>
            {/* Link arms back to the chassis */}
            {[-0.26, 0.26].map((x) => (
              <mesh
                key={x}
                material={M.trim}
                position={[x, 0.02, z < 0 ? 0.17 : -0.17]}
                castShadow
              >
                <boxGeometry args={[0.035, 0.035, 0.34]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Skid plate */}
        <mesh material={M.trim} position={[0, -0.05, -0.5]} castShadow>
          <boxGeometry args={[0.46, 0.03, 0.34]} />
        </mesh>
      </group>

      {/* ── Wheels and shocks ────────────────────────────── */}
      {WHEEL_ANCHORS.map((p, i) => (
        <group key={i} position={p} ref={hold("wheels", i)}>
          <group ref={hold("hubs", i)}>
            <Wheel geometry={tyre} />
          </group>

          {/* Coil-over: the shaft scales with suspension travel. */}
          <group position={[p[0] < 0 ? 0.1 : -0.1, 0.02, p[2] < 0 ? 0.08 : -0.08]} rotation={[0, 0, p[0] < 0 ? 0.26 : -0.26]}>
            <group ref={hold("shocks", i)}>
              <mesh material={M.spring} position={[0, 0.11, 0]} castShadow>
                <cylinderGeometry args={[0.036, 0.036, 0.22, 10]} />
              </mesh>
            </group>
            <mesh material={M.metal} position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.16, 8]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* ── Shell ────────────────────────────────────────── */}
      <group
        ref={(el) => {
          if (rig) rig.current.shell = el;
        }}
      >
        <Shell decal={decal} />
      </group>
    </group>
  );
}

function Shell({ decal }: { decal: THREE.Texture | null }) {
  return (
    <group>
      {/* ── Tub ─────────────────────────────────────────── */}
      <RoundedBox args={[0.76, 0.34, 1.5]} radius={0.035} smoothness={3} position={[0, 0.19, 0.02]} material={M.shell} castShadow receiveShadow />

      {/* Bonnet, raised a touch above the tub as a Wrangler's is */}
      <RoundedBox args={[0.72, 0.08, 0.46]} radius={0.02} smoothness={3} position={[0, 0.36, -0.54]} material={M.shell} castShadow />

      {/* ── Greenhouse ──────────────────────────────────
          A white box with the glass laid on top of it, rather than a dark box
          with white pillars drawn over it. Same part count, and the pillars
          end up the right width instead of whatever is left over. */}
      <RoundedBox args={[0.74, 0.26, 1.06]} radius={0.02} smoothness={3} position={[0, 0.49, 0.19]} material={M.shell} castShadow />

      {/* Four side windows, split by the B-pillar */}
      {[-0.374, 0.374].map((x) =>
        [-0.1, 0.36].map((z) => (
          <mesh key={`${x}-${z}`} material={M.glass} position={[x, 0.5, z]}>
            <boxGeometry args={[0.012, 0.17, 0.42]} />
          </mesh>
        )),
      )}
      {/* Windscreen, raked, and the rear glass */}
      <mesh material={M.glass} position={[0, 0.49, -0.348]} rotation={[0.13, 0, 0]}>
        <boxGeometry args={[0.66, 0.21, 0.02]} />
      </mesh>
      <mesh material={M.glass} position={[0, 0.5, 0.728]}>
        <boxGeometry args={[0.64, 0.17, 0.02]} />
      </mesh>

      {/* Hardtop */}
      <RoundedBox args={[0.76, 0.055, 1.1] } radius={0.018} smoothness={2} position={[0, 0.645, 0.19]} material={M.trim} castShadow />

      {/* ── Front ──────────────────────────────────────── */}
      {/* Grille surround and the seven slots */}
      <mesh material={M.trim} position={[0, 0.29, -0.765]} castShadow>
        <boxGeometry args={[0.62, 0.22, 0.06]} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} material={M.rim} position={[(i - 3) * 0.07, 0.29, -0.795]}>
          <boxGeometry args={[0.044, 0.16, 0.02]} />
        </mesh>
      ))}
      {/* Round headlights, outboard of the grille */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={x} material={M.lamp} position={[x, 0.29, -0.788]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.058, 0.058, 0.03, 16]} />
        </mesh>
      ))}
      {/* Bumper with two fog lamps and a pair of recovery hooks */}
      <mesh material={M.trim} position={[0, 0.07, -0.83]} castShadow>
        <boxGeometry args={[0.8, 0.11, 0.12]} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} material={M.accent} position={[x, 0.07, -0.892]}>
          <boxGeometry args={[0.05, 0.045, 0.03]} />
        </mesh>
      ))}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} material={M.lamp} position={[x, 0.07, -0.892]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.02, 12]} />
        </mesh>
      ))}

      {/* ── Sides ──────────────────────────────────────── */}
      {/* Fender flares, wide enough to cover the tyres */}
      {WHEEL_ANCHORS.map(([x, , z], i) => (
        <RoundedBox
          key={i}
          args={[0.17, 0.08, 0.6]}
          radius={0.03}
          smoothness={2}
          position={[x > 0 ? 0.4 : -0.4, 0.15, z]}
          material={M.trim}
          castShadow
        />
      ))}
      {/* Rock sliders */}
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} material={M.trim} position={[x, 0.025, 0.04]} castShadow>
          <boxGeometry args={[0.07, 0.05, 0.72]} />
        </mesh>
      ))}
      {/* Door shut lines */}
      {[-0.382, 0.382].map((x) =>
        [0.12, 0.6].map((z) => (
          <mesh key={`${x}-${z}`} material={M.trim} position={[x, 0.25, z]}>
            <boxGeometry args={[0.006, 0.28, 0.012]} />
          </mesh>
        )),
      )}
      {/* Door handles */}
      {[-0.388, 0.388].map((x) =>
        [-0.08, 0.38].map((z) => (
          <mesh key={`${x}-${z}`} material={M.trim} position={[x, 0.3, z]}>
            <boxGeometry args={[0.014, 0.025, 0.08]} />
          </mesh>
        )),
      )}
      {/* Mirrors on the A-pillar */}
      {[-0.4, 0.4].map((x) => (
        <group key={x} position={[x, 0.5, -0.3]}>
          <mesh material={M.trim}>
            <boxGeometry args={[0.06, 0.016, 0.016]} />
          </mesh>
          <mesh material={M.trim} position={[x < 0 ? -0.04 : 0.04, 0.015, 0]} castShadow>
            <boxGeometry args={[0.02, 0.055, 0.04]} />
          </mesh>
        </group>
      ))}
      {/* RUBICON on the bonnet flanks */}
      {decal &&
        [-0.382, 0.382].map((x) => (
          <mesh key={x} position={[x, 0.3, -0.5]} rotation={[0, x < 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
            <planeGeometry args={[0.28, 0.07]} />
            <meshStandardMaterial map={decal} transparent roughness={0.4} />
          </mesh>
        ))}

      {/* ── Roof ───────────────────────────────────────── */}
      <group position={[0, 0.675, 0.19]}>
        {/* Rack frame */}
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} material={M.trim} position={[x, 0.03, 0]} castShadow>
            <boxGeometry args={[0.03, 0.06, 1.06]} />
          </mesh>
        ))}
        {[-0.51, 0.51].map((z) => (
          <mesh key={z} material={M.trim} position={[0, 0.03, z]} castShadow>
            <boxGeometry args={[0.73, 0.06, 0.03]} />
          </mesh>
        ))}
        {[-0.32, -0.11, 0.11, 0.32].map((z) => (
          <mesh key={z} material={M.trim} position={[0, 0.005, z]}>
            <boxGeometry args={[0.7, 0.012, 0.045]} />
          </mesh>
        ))}

        {/* Orange traction boards down one side, a jerrycan at the back */}
        <mesh material={M.accent} position={[0.22, 0.055, -0.1]} castShadow>
          <boxGeometry args={[0.13, 0.03, 0.66]} />
        </mesh>
        <mesh material={M.accent} position={[0.2, 0.09, 0.38]} castShadow>
          <boxGeometry args={[0.14, 0.1, 0.1]} />
        </mesh>
        {/* Black case on the other side */}
        <mesh material={M.trim} position={[-0.16, 0.075, 0.1]} castShadow>
          <boxGeometry args={[0.24, 0.08, 0.5]} />
        </mesh>
      </group>

      {/* Light bar across the windscreen header */}
      <group position={[0, 0.655, -0.36]}>
        <mesh material={M.trim} castShadow>
          <boxGeometry args={[0.7, 0.05, 0.06]} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} material={M.lamp} position={[(i - 3.5) * 0.085, 0, -0.033]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.02, 10]} />
          </mesh>
        ))}
      </group>

      {/* ── Rear ───────────────────────────────────────── */}
      <mesh material={M.trim} position={[0, 0.07, 0.83]} castShadow>
        <boxGeometry args={[0.8, 0.11, 0.12]} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} material={M.tail} position={[x, 0.24, 0.772]}>
          <boxGeometry args={[0.06, 0.11, 0.02]} />
        </mesh>
      ))}
      {/* Tailgate-mounted kit, offset to one side as a spare carrier is */}
      <mesh material={M.trim} position={[0.1, 0.26, 0.795]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.06]} />
      </mesh>
      <mesh material={M.rim} position={[-0.17, 0.16, 0.785]}>
        <boxGeometry args={[0.16, 0.07, 0.03]} />
      </mesh>
    </group>
  );
}
