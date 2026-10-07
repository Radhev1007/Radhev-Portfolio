"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Detail levels. The driven truck uses "game"; the display plinth and the
 * inspector use "high". They are separate builds rather than a decimated copy
 * of one mesh — decimation on bevelled hard-surface geometry only ever looks
 * broken — so the difference is tessellation and whether the small parts
 * (wiring, screws, door seams, hinges, badges) exist at all.
 */
export const MODELS = {
  game: "/models/scx30-game.glb",
  high: "/models/scx30.glb",
} as const;

export type Detail = keyof typeof MODELS;

// Both GLBs are Draco-compressed; the decoder is served from /public rather
// than pulled off a third-party CDN at runtime.
useGLTF.setDecoderPath("/draco/");

/**
 * The glTF is authored at Axial's published 1/30 dimensions in true metres —
 * 152 × 70 × 70 mm — because a vehicle asset that lies about its size is
 * useless to everything built around it. This is the single constant that puts
 * it into game units, and every dimension below derives from the model rather
 * than being guessed, so the truck, the world and the physics can only
 * disagree in one place.
 *
 * One game unit is about 85 mm, which makes the yard roughly 5.8 m across and
 * the cones 48 mm tall: a real RC crawler park, at the truck's own scale.
 */
export const RC_SCALE = 11.7;

/** Model millimetres to game units. */
const u = (millimetres: number) => (millimetres / 1000) * RC_SCALE;

export const TYRE_R = u(15.5);
export const TRACK = u(28);
export const WHEELBASE = u(45.5);
export const BODY_HALF_W = u(35);
export const TUB_TOP = u(42);
export const OVERALL_LEN = u(152);

/** Front-left, front-right, rear-left, rear-right. Forward is −Z. */
export const WHEEL_ANCHORS: [number, number, number][] = [
  [-TRACK, TYRE_R, -WHEELBASE],
  [TRACK, TYRE_R, -WHEELBASE],
  [-TRACK, TYRE_R, WHEELBASE],
  [TRACK, TYRE_R, WHEELBASE],
];

/** Headlamp lens centres, for the lights that actually illuminate the ground. */
const LAMPS: [number, number, number][] = [
  [-u(21), u(35), -u(64.7)],
  [u(21), u(35), -u(64.7)],
];

const ORDER = ["FL", "FR", "RL", "RR"] as const;

export type Rig = {
  /** Wheel carriers: these steer and take suspension travel. */
  wheels: (THREE.Object3D | null)[];
  /** Hubs inside the carriers: these spin. */
  hubs: (THREE.Object3D | null)[];
  /** Coil-overs: scaled on Y to compress. */
  shocks: (THREE.Object3D | null)[];
  /** The shell, for roll and pitch. */
  body: THREE.Object3D | null;
};

export function emptyRig(): Rig {
  return { wheels: [], hubs: [], shocks: [], body: null };
}

/**
 * Suspension travel is measured in game units but applied to a node inside the
 * scaled model, so it has to come back down. Keeping the conversion in one
 * named function is cheaper than finding out later why the wheels move nearly
 * twelve times too far.
 */
export function toModel(gameUnits: number) {
  return gameUnits / RC_SCALE;
}

/**
 * The hero vehicle: Axial SCX30 Jeep Wrangler JLU, 1/30.
 *
 * Built in Blender from the reference photographs and Axial's own
 * specification, and exported with its rig intact — body, roof system, rear
 * system, chassis, two axles and four wheels that steer and spin
 * independently. This component's only jobs are to put it in the scene at the
 * right size, hand the game a typed handle on the moving parts, and light the
 * headlamps.
 */
export function Scx30({
  rig,
  detail = "game",
  headlights = false,
  castShadow = true,
}: {
  rig?: React.RefObject<Rig>;
  detail?: Detail;
  headlights?: boolean;
  castShadow?: boolean;
}) {
  const { scene } = useGLTF(MODELS[detail]);

  // Two of these exist at once — the one being driven and the one on the
  // plinth — so each gets its own copy of the graph. Materials stay shared.
  const root = useMemo(() => scene.clone(true), [scene]);

  const targets = useMemo(
    () =>
      LAMPS.map((p) =>
        new THREE.Object3D().translateX(p[0]).translateY(p[1] - 0.1).translateZ(p[2] - 6),
      ),
    [],
  );
  const beams = useRef<(THREE.SpotLight | null)[]>([]);

  useLayoutEffect(() => {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
      }
    });
    if (!rig) return;
    rig.current.wheels = ORDER.map((k) => root.getObjectByName(`Wheel${k}`) ?? null);
    rig.current.hubs = ORDER.map((k) => root.getObjectByName(`Hub${k}`) ?? null);
    rig.current.shocks = ORDER.map((k) => root.getObjectByName(`Shock${k}`) ?? null);
    rig.current.body = root.getObjectByName("Body") ?? null;
  }, [root, rig, castShadow]);

  useLayoutEffect(() => {
    beams.current.forEach((b, i) => {
      if (b) b.target = targets[i];
    });
  }, [targets]);

  return (
    <group scale={RC_SCALE}>
      <primitive object={root} />
      {headlights &&
        LAMPS.map((p, i) => (
          <group key={i}>
            <primitive object={targets[i]} />
            <spotLight
              ref={(el: THREE.SpotLight | null) => {
                beams.current[i] = el;
              }}
              position={p}
              angle={0.5}
              penumbra={0.7}
              distance={u(3600)}
              // Candela, not a 0–1 dial: the rest of this scene lights with
              // point lights in the tens, and so does this.
              intensity={30}
              color="#fff4e2"
            />
          </group>
        ))}
    </group>
  );
}

useGLTF.preload(MODELS.game);
