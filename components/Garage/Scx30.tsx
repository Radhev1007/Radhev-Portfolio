"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export const MODEL_URL = "/models/scx30.glb";

/**
 * The glTF is authored at true 1/24 scale in metres — 240 mm nose to spare —
 * because a vehicle asset that lies about its size is useless to anything that
 * comes after it. This is the single constant that puts it into game units,
 * and every dimension below is derived from the model rather than guessed, so
 * the truck, the world and the physics can only disagree in one place.
 */
export const RC_SCALE = 7.4;

/** Model millimetres to game units. */
const u = (millimetres: number) => (millimetres / 1000) * RC_SCALE;

export const TYRE_R = u(27);
export const TRACK = u(43);
export const WHEELBASE = u(66.5);
export const BODY_HALF_W = u(54);
export const TUB_TOP = u(72);
export const OVERALL_LEN = u(240);

/** Front-left, front-right, rear-left, rear-right. Forward is −Z. */
export const WHEEL_ANCHORS: [number, number, number][] = [
  [-TRACK, TYRE_R, -WHEELBASE],
  [TRACK, TYRE_R, -WHEELBASE],
  [-TRACK, TYRE_R, WHEELBASE],
  [TRACK, TYRE_R, WHEELBASE],
];

/** Headlamp lens centres, for the lights that actually illuminate the ground. */
const LAMPS: [number, number, number][] = [
  [-u(33), u(58), -u(104)],
  [u(33), u(58), -u(104)],
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
 * named function is cheaper than finding out later why the wheels move seven
 * times too far.
 */
export function toModel(gameUnits: number) {
  return gameUnits / RC_SCALE;
}

/**
 * The hero vehicle.
 *
 * Built in Blender from the reference photographs and exported as a glTF with
 * its rig intact — body, roof system, rear system, chassis, two axles and four
 * wheels that steer and spin independently. This component's only jobs are to
 * put it in the scene at the right size, hand the game a typed handle on the
 * moving parts, and light the headlamps.
 */
export function Scx30({
  rig,
  headlights = false,
  castShadow = true,
}: {
  rig?: React.RefObject<Rig>;
  headlights?: boolean;
  castShadow?: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL);

  // Two of these exist at once — the one being driven and the one on the
  // plinth — so each gets its own copy of the graph. Materials stay shared.
  const root = useMemo(() => scene.clone(true), [scene]);

  const targets = useMemo(
    () => LAMPS.map((p) => new THREE.Object3D().translateX(p[0]).translateY(p[1] - 0.1).translateZ(p[2] - 6)),
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
              angle={0.52}
              penumbra={0.7}
              distance={u(4200)}
              // Candela, not a 0–1 dial: the rest of this scene lights with
              // point lights in the tens, and so does this.
              intensity={34}
              color="#fff4e2"
            />
          </group>
        ))}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
