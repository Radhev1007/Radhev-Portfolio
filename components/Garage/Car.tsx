"use client";

import {
  CoefficientCombineRule,
  RapierRigidBody,
  RigidBody,
  useRapier,
} from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Controls } from "./useControls";

const SPAWN: [number, number, number] = [0, 1.2, 6];

// Arcade handling constants. Speeds are metres per second; the HUD reads them
// out multiplied by eight so a scale-model car shows scale-model numbers.
const ACCEL = 17;
const REVERSE_ACCEL = 11;
const TOP = 14;
const REVERSE_TOP = 6;
const BOOST = 1.55;
/** Fraction of forward speed kept per second when coasting / on the handbrake. */
const COAST = 0.45;
const HANDBRAKE = 0.12;
/** Fraction of sideways speed kept per second — low is grip, high is drift. */
const GRIP = 0.015;
const DRIFT_GRIP = 0.6;

/**
 * The player's RC car.
 *
 * Physics and visuals are deliberately separate: a single rigid body carries
 * the mass and collides with the world, and the wheels are visual children
 * that steer and spin. Swapping the shell for a real model later means
 * replacing the meshes in `Body` and nothing else.
 *
 * The driving model is arcade, not simulation — forces at the chassis rather
 * than per-wheel friction — because the brief asks for lightweight and
 * playful, and a raycast vehicle tuned badly feels far worse than simple
 * forces tuned well.
 */
export function Car({
  controls,
  onState,
}: {
  controls: React.RefObject<Controls>;
  onState: (s: { speed: number; airborne: boolean }) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const steer = useRef(0);
  const spin = useRef(0);
  const { world, rapier } = useRapier();

  const v = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const q = new THREE.Quaternion();

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    const c = controls.current;
    const d = Math.min(delta, 0.05);

    if (c.reset) {
      rb.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      return;
    }

    const rot = rb.rotation();
    q.set(rot.x, rot.y, rot.z, rot.w);
    forward.set(0, 0, -1).applyQuaternion(q);

    const lin = rb.linvel();
    v.set(lin.x, lin.y, lin.z);
    const speed = v.length();
    const travellingForward = v.dot(forward) > 0;

    // Grounded test: a short ray straight down from the chassis, ignoring the
    // car's own body so it cannot detect itself.
    const origin = rb.translation();
    const ray = new rapier.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: 0, y: -1, z: 0 });
    const grounded = world.castRay(ray, 0.6, true, undefined, undefined, undefined, rb) !== null;

    const throttle = (c.forward ? 1 : 0) - (c.back ? 1 : 0);
    const boost = c.boost ? BOOST : 1;

    // Velocity is split into the component along the nose and the component
    // sliding sideways, then both are rewritten. Doing it this way rather than
    // with impulses means the throttle, the drag and the grip are one decision
    // instead of three that overwrite each other.
    if (grounded) {
      const along = lin.x * forward.x + lin.z * forward.z;

      let next = along;
      if (throttle > 0) next += ACCEL * boost * d;
      else if (throttle < 0) next -= REVERSE_ACCEL * d;
      else next *= Math.pow(COAST, d);
      if (c.brake) next *= Math.pow(HANDBRAKE, d);
      next = Math.max(-REVERSE_TOP, Math.min(TOP * boost, next));

      // Whatever is left over is the slide. Killing most of it per second is
      // what makes the car feel gripped; keeping it is what makes it drift.
      const keep = Math.pow(c.brake ? DRIFT_GRIP : GRIP, d);
      const lateralX = lin.x - forward.x * along;
      const lateralZ = lin.z - forward.z * along;

      rb.setLinvel(
        {
          x: forward.x * next + lateralX * keep,
          y: lin.y,
          z: forward.z * next + lateralZ * keep,
        },
        true,
      );
    }

    // Steering authority rises with speed, so it does not spin on the spot.
    const want = ((c.left ? 1 : 0) - (c.right ? 1 : 0)) * 0.55;
    steer.current += (want - steer.current) * Math.min(1, 10 * d);
    if (grounded && speed > 0.4) {
      const bite = c.brake ? 1.25 : 1;
      const turn = steer.current * Math.min(speed, 9) * 0.42 * bite * (travellingForward ? 1 : -1);
      rb.setAngvel({ x: 0, y: turn, z: 0 }, true);
    }

    // Wheels: steer the fronts, spin all four with travel.
    spin.current += speed * d * (travellingForward ? 6 : -6);
    wheels.current.forEach((w, i) => {
      if (!w) return;
      if (i < 2) w.rotation.y = steer.current * 0.6;
      w.children[0] && ((w.children[0] as THREE.Mesh).rotation.x = spin.current);
    });

    onState({ speed, airborne: !grounded });
  });

  return (
    <RigidBody
      ref={body}
      colliders="cuboid"
      position={SPAWN}
      mass={1.1}
      linearDamping={0.4}
      angularDamping={2.2}
      // The handling model above writes the car's velocity outright, so contact
      // friction is not grip here — it is a brake fighting the throttle. Taking
      // the lower of the two coefficients keeps the ground grippy for the props
      // the car knocks about while leaving the car itself free to drive.
      friction={0.12}
      frictionCombineRule={CoefficientCombineRule.Min}
      restitution={0.1}
      canSleep={false}
      ccd
      name="rc-car"
    >
      <Body wheels={wheels} />
    </RigidBody>
  );
}

/** Visual shell only — replace these meshes to swap in a real RC model. */
function Body({ wheels }: { wheels: React.RefObject<(THREE.Group | null)[]> }) {
  const positions: [number, number, number][] = [
    [-0.42, -0.16, -0.52],
    [0.42, -0.16, -0.52],
    [-0.42, -0.16, 0.52],
    [0.42, -0.16, 0.52],
  ];

  return (
    <group>
      {/* Chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.86, 0.3, 1.5]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.45} metalness={0.3} />
      </mesh>
      {/* Shell */}
      <mesh castShadow position={[0, 0.22, -0.08]}>
        <boxGeometry args={[0.78, 0.2, 0.95]} />
        <meshStandardMaterial color="#f43c00" roughness={0.3} metalness={0.15} />
      </mesh>
      {/* Wing */}
      <mesh castShadow position={[0, 0.34, 0.6]}>
        <boxGeometry args={[0.7, 0.04, 0.22]} />
        <meshStandardMaterial color="#111" roughness={0.5} />
      </mesh>

      {positions.map((p, i) => (
        <group
          key={i}
          position={p}
          ref={(el) => {
            wheels.current[i] = el;
          }}
        >
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.17, 18]} />
            <meshStandardMaterial color="#141414" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
