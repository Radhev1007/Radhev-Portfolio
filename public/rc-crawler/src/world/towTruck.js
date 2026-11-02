// Tow recovery. A truck on its side or roof is not teleported away: a tow truck drives up, hooks a cable on,
// winches it back onto its wheels where it lies, and drives off.
//
//   approach (2.6 s) -> hook (0.5 s) -> winch (1.6 s) -> release -> leave (2.2 s)
//
// While it runs the player's physics are frozen and the truck is posed by the sequence; at the release the
// truck is put down upright at the same spot (same x/z and heading) and the physics take over again.
import * as THREE from 'three';

const APPROACH = 2.6, HOOK = 0.5, WINCH = 1.6, LEAVE = 2.2;
const FROM = 14, STOP = 3.4;    // m: where the tow truck appears, and how far from the wreck it stops

/**
 * Where the tow truck comes from: FROM m out, preferring straight behind the wreck, then the sides, then in
 * front; a direction is usable if its whole path is inside the map and no steeper than ~25 degrees.
 */
export function towApproach(hf, pos, yaw) {
  const lim = hf.half - 3;
  for (const off of [Math.PI, Math.PI * 0.75, -Math.PI * 0.75, Math.PI / 2, -Math.PI / 2, 0]) {
    const a = yaw + off, dx = Math.sin(a), dz = Math.cos(a);
    let ok = true, prevH = hf.heightAt(pos.x + dx * STOP, pos.z + dz * STOP);
    for (let d = STOP + 1; d <= FROM; d += 1) {
      const x = pos.x + dx * d, z = pos.z + dz * d;
      if (Math.abs(x) > lim || Math.abs(z) > lim) { ok = false; break; }
      const h = hf.heightAt(x, z);
      if (Math.abs(h - prevH) > 0.47) { ok = false; break; }
      prevH = h;
    }
    if (!ok) continue;
    return { from: { x: pos.x + dx * FROM, z: pos.z + dz * FROM }, stop: { x: pos.x + dx * STOP, z: pos.z + dz * STOP }, faceYaw: a + Math.PI };
  }
  return null;
}

/** The pose a rolled truck is winched to: upright, same heading, a little above the ground. */
export function rightedPose(pos, q) {
  const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const yaw = Math.atan2(f.x, f.z);
  return { x: pos.x, z: pos.z, yaw, q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw) };
}

function buildModel() {
  const g = new THREE.Group(); g.name = 'towTruck';
  const paint = new THREE.MeshStandardMaterial({ color: 0xf2b632, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.1, metalness: 0.3 });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  box(0.95, 0.42, 1.05, paint, 0, 0.62, 0.72);        // cab
  box(0.88, 0.26, 0.5, glass, 0, 0.92, 0.82);          // windows
  box(0.97, 0.1, 2.4, dark, 0, 0.36, 0.05);            // chassis
  box(0.95, 0.28, 1.25, paint, 0, 0.55, -0.55);        // bed
  box(0.97, 0.06, 0.3, paint, 0, 0.42, 1.27);          // bumper
  const lights = [];
  for (const sx of [-0.3, 0.3]) { const l = box(0.22, 0.07, 0.12, new THREE.MeshStandardMaterial({ color: 0x5a3a05, emissive: 0xff9a10, emissiveIntensity: 0 }), sx, 1.09, 0.82); lights.push(l); }
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 16); wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[0.46, 0.78], [-0.46, 0.78], [0.46, -0.6], [-0.46, -0.6]]) { const w = new THREE.Mesh(wheelGeo, dark); w.position.set(x, 0.22, z); w.castShadow = true; g.add(w); wheels.push(w); }
  // the boom over the back, with its winch line
  const boom = new THREE.Group(); boom.position.set(0, 0.72, -0.95); g.add(boom);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.1), steel); arm.position.set(0, 0.2, -0.45); arm.rotation.x = -0.45; arm.castShadow = true; boom.add(arm);
  const tip = new THREE.Object3D(); tip.position.set(0, 0.45, -0.95); boom.add(tip);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x111111 }));
  line.frustumCulled = false; line.visible = false;
  return { g, lights, wheels, tip, line };
}

export class TowRecovery {
  constructor(scene) {
    this.scene = scene;
    this.m = buildModel();
    this.m.g.visible = false;
    scene.add(this.m.g, this.m.line);
    this.active = false;
  }

  /** Begin a recovery of `phys` (on its side or roof). False if there is no way in for the tow truck. */
  start(phys, hf) {
    const path = towApproach(hf, phys.pos, phys.yaw);
    if (!path) return false;
    this.hf = hf; this.path = path; this.t = 0; this.active = true; this.phase = 'approach';
    this.from = phys.pos.clone(); this.fromQ = phys.q.clone();
    this.to = rightedPose(phys.pos, phys.q);
    this.m.g.visible = true;
    this.place(path.from.x, path.from.z, path.faceYaw);
    return true;
  }

  place(x, z, yaw) {
    const g = this.m.g, hf = this.hf;
    g.position.set(x, hf.heightAt(x, z) - 0.02, z);
    // sit on the slope: pitch from the ground ahead and behind
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const pitch = Math.atan2(hf.heightAt(x - fx * 0.8, z - fz * 0.8) - hf.heightAt(x + fx * 0.8, z + fz * 0.8), 1.6);
    g.rotation.set(0, yaw, 0); g.rotateX(pitch);
  }

  /**
   * Advance the sequence; poses `model` (the player's truck) while it runs. Returns 'release' on the frame the
   * truck is to be put down (the caller re-places the physics there), 'done' when the tow truck has gone.
   */
  update(dt, model) {
    if (!this.active) return null;
    this.t += dt;
    const p = this.path, m = this.m, ease = (k) => k * k * (3 - 2 * k);
    for (const l of m.lights) l.material.emissiveIntensity = Math.sin(this.t * 12) > 0 ? 2.5 : 0;
    const roll = (d) => { for (const w of m.wheels) w.rotation.x -= d / 0.22; };
    let out = null;
    if (this.phase === 'approach') {
      const k = Math.min(1, this.t / APPROACH), e = ease(k);
      const x = p.from.x + (p.stop.x - p.from.x) * e, z = p.from.z + (p.stop.z - p.from.z) * e;
      roll(Math.hypot(x - m.g.position.x, z - m.g.position.z));
      this.place(x, z, p.faceYaw);
      if (k >= 1) { this.phase = 'hook'; this.t = 0; }
    } else if (this.phase === 'hook') {
      if (this.t >= HOOK) { this.phase = 'winch'; this.t = 0; }
    } else if (this.phase === 'winch') {
      const k = ease(Math.min(1, this.t / WINCH));
      model.group.quaternion.copy(this.fromQ).slerp(this.to.q, k);
      model.group.position.set(this.from.x, this.from.y + Math.sin(k * Math.PI) * 0.45 + k * 0.05, this.from.z);
      if (this.t >= WINCH) { this.phase = 'leave'; this.t = 0; out = 'release'; }
    } else if (this.phase === 'leave') {
      const k = Math.min(1, this.t / LEAVE), e = k * k;
      const x = p.stop.x + (p.from.x - p.stop.x) * e, z = p.stop.z + (p.from.z - p.stop.z) * e;
      roll(-Math.hypot(x - m.g.position.x, z - m.g.position.z));
      this.place(x, z, p.faceYaw);     // backs away the way it came
      if (k >= 1) { this.active = false; m.g.visible = false; out = 'done'; }
    }
    // the winch line, from the boom tip to the truck while it is hooked on
    const hooked = this.phase === 'hook' || this.phase === 'winch';
    m.line.visible = hooked;
    if (hooked) {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      m.tip.getWorldPosition(a);
      b.copy(this.phase === 'winch' ? model.group.position : this.from); b.y += 0.3;
      m.line.geometry.setFromPoints([a, b]);
    }
    if (this.phase === 'hook' || this.phase === 'approach') { model.group.position.copy(this.from); model.group.quaternion.copy(this.fromQ); }
    return out;
  }

  cancel() { this.active = false; this.m.g.visible = false; this.m.line.visible = false; }
  dispose() { this.cancel(); this.scene.remove(this.m.g, this.m.line); }
}
