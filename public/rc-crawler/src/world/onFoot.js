// On foot: the driver out of the truck, GTA-style. F gets out beside the truck (driver's side first) when it is
// upright and stopped, and back in when he is near it. W/S walk forward and back along his facing, A/D turn,
// Shift runs. He follows the ground, cannot climb walls or cliffs, and walks round trees and posts.
import * as THREE from 'three';
import { FIGURE } from '../vehicles/driverRig.js';

const WALK = 0.55, RUN = 1.5, BACK = 0.35;   // game units/s (the driver is 0.72 tall)
const TURN = 2.6;                             // rad/s
const ACCEL = 5;                              // how quickly he gets to speed (units/s²)
const STEP = 0.22;                            // the highest ledge he steps up in one go
const MAX_GRADE = 1.3;                        // rise per unit run he can walk up (~52°)
const STRIDE = 0.42;                          // ground covered per stride (2π of walk phase) at walking pace
export const ENTER_DIST = 1.1;                // how near the truck he must be to get back in

export class OnFoot {
  constructor() {
    this.pos = new THREE.Vector3(); this.yaw = 0; this.speed = 0; this.phase = 0;
    this.stats = { speed: 0, suspension: 0, impact: 0 };   // what the camera rig reads from a "vehicle"
  }

  place(p, yaw) { this.pos.copy(p); this.yaw = yaw; this.speed = 0; }

  /** inp: { forward -1..1, turn -1..1 (left positive), run }; trunks: [{x, z, r}] */
  update(dt, inp, hf, trunks = []) {
    this.yaw += (inp.turn || 0) * TURN * dt;
    const f = inp.forward || 0;
    const target = f > 0 ? f * (inp.run ? RUN : WALK) : f * BACK;
    this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), ACCEL * dt);
    const dx = Math.sin(this.yaw) * this.speed * dt, dz = Math.cos(this.yaw) * this.speed * dt;
    const step = Math.hypot(dx, dz);
    if (step > 1e-6) {
      const lim = hf.half - 1;
      const nx = Math.max(-lim, Math.min(lim, this.pos.x + dx)), nz = Math.max(-lim, Math.min(lim, this.pos.z + dz));
      const h0 = hf.heightAt(this.pos.x, this.pos.z), h1 = hf.heightAt(nx, nz), rise = h1 - h0;
      if (rise > STEP || rise / step > MAX_GRADE * (rise > 0.02 ? 1 : 99)) this.speed = 0;   // a wall or cliff
      else { this.pos.x = nx; this.pos.z = nz; }
    }
    for (const t of trunks) {   // round trees and posts
      const ox = this.pos.x - t.x, oz = this.pos.z - t.z, d = Math.hypot(ox, oz), min = t.r + FIGURE.radius;
      if (d < min && d > 1e-6) { this.pos.x = t.x + (ox / d) * min; this.pos.z = t.z + (oz / d) * min; }
    }
    this.pos.y = hf.heightAt(this.pos.x, this.pos.z);
    this.phase += (this.speed / STRIDE) * Math.PI * 2 * dt * (Math.abs(this.speed) > RUN * 0.7 ? 0.62 : 1);
    this.stats.speed = this.speed;
  }

  /** how much of a walk to pose: 0 standing, 1 walking, 1.6 running */
  get gait() { const v = Math.abs(this.speed); return v < WALK ? v / WALK : 1 + Math.min(0.6, ((v - WALK) / (RUN - WALK)) * 0.6); }
}

/** He can get out when the truck is on its wheels and (nearly) stopped. */
export const canExit = (phys) => phys.up.y > 0.7 && Math.abs(phys.stats.speed) < 0.5;

/** Where he steps out: beside the driver's door (the truck's left), else the right, behind, in front. */
export function exitSpot(hf, pos, yaw) {
  const h = hf.heightAt(pos.x, pos.z), lim = hf.half - 1, d = FIGURE.exitDist;
  const left = [Math.cos(yaw), -Math.sin(yaw)], fwd = [Math.sin(yaw), Math.cos(yaw)];
  for (const [ax, az] of [left, [-left[0], -left[1]], [-fwd[0], -fwd[1]], fwd]) {
    const x = pos.x + ax * d, z = pos.z + az * d;
    if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
    if (Math.abs(hf.heightAt(x, z) - h) > 0.4) continue;
    return { x, z, yaw };
  }
  return { x: pos.x + left[0] * d, z: pos.z + left[1] * d, yaw };
}
