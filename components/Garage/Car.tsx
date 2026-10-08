"use client";

import {
  CoefficientCombineRule,
  CuboidCollider,
  RapierRigidBody,
  RigidBody,
  useRapier,
} from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { emptyRig, type Rig, Scx30, toModel, TYRE_R, WHEEL_ANCHORS } from "./Scx30";
import type { Controls } from "./useControls";

// Off to one side of the cone slalom, so the first thing anyone does is drive
// rather than immediately knock a cone over. The model's origin is at its own
// ground plane, so this is resting height: dropping the truck in means it is
// falling during the first few frames, and the first few frames of a page that
// is still loading can be very long ones.
const SPAWN: [number, number, number] = [4, 0.02, 9];

/**
 * Crawler handling, not racing handling. The brief asks for torque, traction
 * and technical driving, so the numbers are deliberately small: this thing
 * tops out at a walking pace in world terms and gets there quickly, which is
 * exactly how a scale crawler behaves.
 */
const ACCEL = 10;
const REVERSE_ACCEL = 7;
const TOP = 6.2;
const REVERSE_TOP = 3.6;
const BOOST = 1.45;
/** Fraction of forward speed kept per second when coasting / braking. */
const COAST = 0.3;
const BRAKE = 0.04;
/** Fraction of sideways speed kept per second. Low, because crawlers grip. */
const GRIP = 0.008;
const MAX_STEER = 0.55;
/** Below this a thumb resting on the pad counts as centred. */
const DEADZONE = 0.12;
/** Visual suspension travel either side of rest, in game units. */
const TRAVEL = 0.06;
/** How far above the body origin the grounding ray starts. */
const RAY_UP = 0.4;

/**
 * The player's vehicle.
 *
 * Physics and visuals are separate: one cuboid carries the mass and the
 * collisions, and everything the eye reads as mechanical — wheels steering,
 * tyres turning, shocks compressing, the shell rolling into a corner — is
 * driven on top of it from four downward raycasts. A proper raycast vehicle
 * would simulate all of that for real, and would also feel considerably worse
 * for the five minutes anyone spends here.
 *
 * The one piece of real simulation is the slope: the drive direction is the
 * nose projected onto the ground's normal, which is what lets the truck climb
 * a ramp or a rock instead of pushing into it.
 */
export function Car({
  controls,
  onState,
}: {
  controls: React.RefObject<Controls>;
  onState: (s: { speed: number; airborne: boolean }) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const rig = useRef<Rig>(emptyRig());
  const steer = useRef(0);
  const spin = useRef(0);
  const travel = useRef([0, 0, 0, 0]);
  const roll = useRef(0);
  const pitch = useRef(0);
  const lastAlong = useRef(0);
  const { world, rapier } = useRapier();

  const vec = useMemo(
    () => ({
      v: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      drive: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      lateral: new THREE.Vector3(),
      anchor: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );
  const ray = useMemo(
    () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
    [rapier],
  );

  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    const c = controls.current;
    const d = Math.min(delta, 0.05);
    const { v, forward, drive, normal, lateral, anchor, q } = vec;

    // R, or falling out of the world — which should not happen, but a game
    // that silently drops you into the void is worse than one that admits it.
    if (c.reset || rb.translation().y < -4) {
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

    const o = rb.translation();
    ray.origin.x = o.x;
    ray.origin.y = o.y + RAY_UP;
    ray.origin.z = o.z;
    const hit = world.castRayAndGetNormal(ray, RAY_UP + 0.3, true, undefined, undefined, undefined, rb);
    const grounded = hit !== null;

    // Drive along the slope rather than through it.
    drive.copy(forward);
    if (hit) {
      normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      drive.addScaledVector(normal, -drive.dot(normal));
      if (drive.lengthSq() < 1e-6) drive.copy(forward);
    } else {
      drive.y = 0;
    }
    drive.normalize();

    const along = v.dot(drive);
    // Touch writes analog axes, the keys are full deflection, and either can
    // drive. A crawler wants fine steering more than anything else, which is
    // the whole reason the axes exist.
    const axis = (v: number) => (Math.abs(v) < DEADZONE ? 0 : v);
    const throttle = axis(c.throttleAxis) || (c.forward ? 1 : 0) - (c.back ? 1 : 0);
    const steerInput = -axis(c.steerAxis) || (c.left ? 1 : 0) - (c.right ? 1 : 0);
    const boost = c.boost ? BOOST : 1;

    if (grounded) {
      let next = along;
      if (throttle > 0) next += ACCEL * boost * throttle * d;
      else if (throttle < 0) next += REVERSE_ACCEL * throttle * d;
      else next *= Math.pow(COAST, d);
      if (c.brake) next *= Math.pow(BRAKE, d);
      next = Math.max(-REVERSE_TOP, Math.min(TOP * boost, next));

      lateral.copy(v).addScaledVector(drive, -along);
      const keep = Math.pow(GRIP, d);

      rb.setLinvel(
        {
          x: drive.x * next + lateral.x * keep,
          y: drive.y * next + lateral.y * keep,
          z: drive.z * next + lateral.z * keep,
        },
        true,
      );
    }

    // Steering. Only the yaw is written — pitch and roll are left to the
    // solver, so the truck can still tip and settle on uneven ground.
    const want = steerInput * MAX_STEER;
    steer.current += (want - steer.current) * Math.min(1, 9 * d);
    if (grounded && Math.abs(along) > 0.2) {
      const av = rb.angvel();
      const turn = steer.current * Math.min(Math.abs(along), 5) * 0.74 * (along > 0 ? 1 : -1);
      rb.setAngvel({ x: av.x, y: turn, z: av.z }, true);
    }

    /* ── Everything below here is cosmetic ─────────────────── */

    // Per-wheel suspension: cast down from each corner and let the wheel find
    // the ground. This is why the truck looks articulated over the rocks even
    // though the collider is a single box.
    for (let i = 0; i < 4; i++) {
      const a = WHEEL_ANCHORS[i];
      anchor.set(a[0], a[1], a[2]).applyQuaternion(q);
      ray.origin.x = o.x + anchor.x;
      ray.origin.y = o.y + anchor.y + 0.2;
      ray.origin.z = o.z + anchor.z;
      const wheelHit = world.castRayAndGetNormal(
        ray,
        0.2 + TYRE_R + TRAVEL,
        true,
        undefined,
        undefined,
        undefined,
        rb,
      );
      const target = wheelHit
        ? Math.max(-TRAVEL, Math.min(TRAVEL, TYRE_R - (wheelHit.timeOfImpact - 0.2)))
        : -TRAVEL;
      travel.current[i] += (target - travel.current[i]) * Math.min(1, 12 * d);

      // These nodes live inside the scaled model, so travel comes back down.
      const wheel = rig.current.wheels[i];
      if (wheel) {
        wheel.position.y = toModel(travel.current[i]);
        if (i < 2) wheel.rotation.y = steer.current;
      }
      const shock = rig.current.shocks[i];
      if (shock) {
        shock.scale.y = Math.max(0.7, Math.min(1.25, 1 - (travel.current[i] / TRAVEL) * 0.26));
      }
    }

    // Rolling tyres.
    spin.current += (along / TYRE_R) * d;
    for (const hub of rig.current.hubs) if (hub) hub.rotation.x = -spin.current;

    // Body roll into a corner and squat under power — small numbers, because
    // the point is that you notice it without being able to name it.
    const lateralLoad = steer.current * Math.min(Math.abs(along), 6) * (along > 0 ? 1 : -1);
    roll.current += (lateralLoad * 0.02 - roll.current) * Math.min(1, 6 * d);
    const accel = (along - lastAlong.current) / d;
    lastAlong.current = along;
    pitch.current +=
      (Math.max(-0.05, Math.min(0.05, accel * 0.004)) - pitch.current) * Math.min(1, 5 * d);
    if (rig.current.body) {
      rig.current.body.rotation.z = roll.current;
      rig.current.body.rotation.x = pitch.current;
    }

    onState({ speed, airborne: !grounded });
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={SPAWN}
      linearDamping={0.3}
      angularDamping={2.6}
      canSleep={false}
      ccd
      name="rc-car"
    >
      {/* One box for the whole truck, sized off the model: as wide as the
          flares, as long as bumper to spare, and its underside level with the
          tyres. The wheels are visual, so giving them colliders would only add
          ways for the thing to catch on scenery. */}
      <CuboidCollider
        args={[0.41, 0.245, 0.89]}
        position={[0, 0.245, 0]}
        mass={1.6}
        // With the velocity authored outright above, contact friction is not
        // grip — it is a brake fighting the throttle. Taking the lower of the
        // two coefficients keeps the ground grippy for the props the truck
        // shunts around while leaving the truck itself free to drive.
        friction={0.12}
        frictionCombineRule={CoefficientCombineRule.Min}
        restitution={0.05}
      />
      <Scx30 rig={rig} detail="game" headlights />
    </RigidBody>
  );
}
