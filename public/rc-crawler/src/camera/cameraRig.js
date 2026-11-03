// Cinematic camera: chase / close RC / low ground / cinematic auto-director / free orbit, plus intro orbit; and
// cameras mounted on the truck: front bumper, wheel inspection, driver (first person).
import * as THREE from 'three';

export const CAM_MODES = ['Chase', 'Close RC', 'Low Ground', 'Cinematic', 'Free', 'Bumper', 'Wheel', 'Driver'];
const MOUNTED = { 5: 'Bumper', 6: 'Wheel', 7: 'Driver' };
const _mp = new THREE.Vector3(), _ml = new THREE.Vector3();

/**
 * A camera fixed to the truck (it pitches and rolls with it). info: the truck's own geometry in its frame —
 * noseZ (front of the body), halfTrack, wheelR, hubY (front-left hub height), hood (hood height), eye (world
 * position of the driver's eyes when he is seated, else null). Returns world { pos, look, up, fov }.
 */
export function mountedView(kind, car, info) {
  const m = car.matrixWorld, at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.getWorldQuaternion(new THREE.Quaternion()));
  if (kind === 'Bumper') return { pos: at(0, 0.1, info.noseZ + 0.04), look: at(0, 0.02, info.noseZ + 2.5), up, fov: 72 };
  if (kind === 'Wheel') {
    // out beside the front-left wheel and a little ahead of it, looking back at the hub: steering, articulation
    // and the tyre squashing are all in view
    const hub = at(info.halfTrack, info.hubY, 0.56);
    const r = info.wheelR;   // (the distance follows the tyre size, so the whole wheel and its axle are in frame)
    return { pos: at(info.halfTrack + 0.25 + r * 2, info.hubY + r * 0.9, 0.56 + r * 2.2), look: hub, up, fov: 50 };
  }
  // Driver: his eyes when he is in an open cockpit, else just above the hood (a closed shell has no view out)
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(car.getWorldQuaternion(new THREE.Quaternion()));
  const pos = info.eye ? info.eye.clone().addScaledVector(fwd, 0.05) : at(0, info.hood + 0.06, 0.2);
  return { pos, look: pos.clone().addScaledVector(fwd, 3).addScaledVector(up, -0.25), up, fov: 74 };
}

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _t = new THREE.Vector3();

export class CameraRig {
  constructor(camera, hf) {
    this.cam = camera;
    this.hf = hf;
    this.mode = 0;
    this.yawOff = 0; this.pitchOff = 0; this.zoom = 1;
    this.freeYaw = 0; this.freePitch = 0.35; this.freeDist = 5;
    this.pos = new THREE.Vector3(0, 5, -5);
    this.look = new THREE.Vector3();
    this.lastMouse = 0;
    this.shake = 0;
    this.cine = { t: 0, shot: 0, anchor: new THREE.Vector3(), dur: 7 };
    this.intro = false; this.introT = 0;
    this.transition = 0; // 0..1 blend from intro to gameplay
    this.focusDist = 4;
  }

  setHeightfield(hf) { this.hf = hf; }
  cycle() { this.mode = (this.mode + 1) % CAM_MODES.length; this.cine.t = 999; this.modeT = 0; if (this.mode === 4) { this.freeDist = 5; } return CAM_MODES[this.mode]; }
  get mounted() { return !this.intro && !!MOUNTED[this.mode]; }
  orbit(dx, dy) {
    this.lastMouse = performance.now();
    if (this.mode === 4 || this.intro || this.inspect) { this.freeYaw -= dx * 0.005; this.freePitch = THREE.MathUtils.clamp(this.freePitch + dy * 0.004, -0.1, 1.35); }
    else { this.yawOff -= dx * 0.005; this.pitchOff = THREE.MathUtils.clamp(this.pitchOff + dy * 0.004, -0.4, 0.9); }
  }
  wheel(d) { this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + d * 0.001), 0.45, 2.6); this.freeDist = THREE.MathUtils.clamp(this.freeDist * (1 + d * 0.001), 1.6, 20); }

  _groundClamp(p, min = 0.35) {
    if (!this.hf) return p;
    const h = Math.max(this.hf.heightAt(p.x, p.z), this.hf.waterBodies?.length ? this.hf.waterDepthAt(p.x, p.z) > 0 ? this.hf.heightAt(p.x, p.z) + this.hf.waterDepthAt(p.x, p.z) : -1e9 : -1e9);
    if (p.y < h + min) p.y = h + min;
    return p;
  }

  /** view: the truck's geometry for the mounted cameras (see mountedView); without it they fall back to the chase. */
  update(dt, car, phys, view = null) {
    this.modeT = (this.modeT ?? 9) + dt;
    if (this.mounted && view) return this._mounted(dt, car, phys, view);
    this.cam.up.set(0, 1, 0);
    const cp = car.position;
    const yaw = phys.yaw;
    const speed = Math.abs(phys.stats.speed);
    const fwd = _v.set(Math.sin(yaw), 0, Math.cos(yaw));
    let desired = new THREE.Vector3(), look = new THREE.Vector3(), lerpK = 4, fov = 50;
    // mouse offset decays back after idle (not in free)
    if (performance.now() - this.lastMouse > 2500 && this.mode !== 4) { this.yawOff *= Math.exp(-dt * 1.2); this.pitchOff *= Math.exp(-dt * 1.2); }

    if (this.inspect) {
      // the garage's inspection view: a slow turntable round the parked truck, dragged round by the mouse
      this.freeYaw += dt * 0.25;
      const d = 2.5 * this.zoom, pitch = THREE.MathUtils.clamp(this.freePitch, 0.05, 1.2);
      desired.set(cp.x + Math.sin(this.freeYaw) * Math.cos(pitch) * d, cp.y + 0.25 + Math.sin(pitch) * d, cp.z + Math.cos(this.freeYaw) * Math.cos(pitch) * d);
      look.set(cp.x, cp.y + 0.12, cp.z); lerpK = 4; fov = 38;
    } else if (this.intro) {
      this.introT += dt;
      const a = this.freeYaw + this.introT * 0.12;
      const d = 3.4 + Math.sin(this.introT * 0.15) * 0.5;
      desired.set(cp.x + Math.sin(a) * d, cp.y + 0.55 + Math.sin(this.introT * 0.2) * 0.25 + this.freePitch * 0.8, cp.z + Math.cos(a) * d);
      look.set(cp.x, cp.y + 0.2, cp.z);
      lerpK = 3; fov = 38;
    } else if (this.mode === 0 || this.mode === 1 || this.mode === 2 || MOUNTED[this.mode]) {
      const cfg = [
        { dist: 3.6, h: 1.35, look: 0.25, fov: 50 },
        { dist: 2.0, h: 0.75, look: 0.2, fov: 55 },
        { dist: 2.4, h: 0.22, look: 0.35, fov: 48 },
      ][MOUNTED[this.mode] ? 0 : this.mode];
      const dist = cfg.dist * this.zoom * (1 + speed * 0.04);
      const a = yaw + Math.PI + this.yawOff;
      const pitch = cfg.h / dist + this.pitchOff;
      desired.set(cp.x + Math.sin(a) * dist * Math.cos(pitch * 0.6), cp.y + cfg.h * this.zoom + this.pitchOff * dist * 0.8, cp.z + Math.cos(a) * dist * Math.cos(pitch * 0.6));
      look.set(cp.x + fwd.x * 0.6, cp.y + cfg.look, cp.z + fwd.z * 0.6);
      lerpK = this.mode === 2 ? 5 : 3.5; fov = cfg.fov;
    } else if (this.mode === 3) {
      // auto director: fixed tripod shots near the trail ahead, low tracking shots, orbit shots
      const c = this.cine;
      c.t += dt;
      const distTo = c.anchor.distanceTo(cp);
      if (c.t > c.dur || (c.shot === 0 && distTo > 9)) {
        c.t = 0; c.shot = (c.shot + 1) % 3; c.dur = 6 + Math.random() * 4;
        if (c.shot === 0) {
          const side = Math.random() < 0.5 ? -1 : 1;
          c.anchor.set(cp.x + fwd.x * 4 + fwd.z * side * 2.2, 0, cp.z + fwd.z * 4 - fwd.x * side * 2.2);
          c.anchor.y = (this.hf ? this.hf.heightAt(c.anchor.x, c.anchor.z) : 0) + 0.25 + Math.random() * 0.5;
        }
        c.side = Math.random() < 0.5 ? -1 : 1;
      }
      if (c.shot === 0) { desired.copy(c.anchor); look.set(cp.x, cp.y + 0.15, cp.z); lerpK = 30; fov = 32; }
      else if (c.shot === 1) {
        const a = yaw + Math.PI / 2 * c.side;
        desired.set(cp.x + Math.sin(a) * 2.2, cp.y + 0.2, cp.z + Math.cos(a) * 2.2);
        look.set(cp.x, cp.y + 0.1, cp.z); lerpK = 3; fov = 40;
      } else {
        const a = yaw + c.t * 0.25 * c.side + Math.PI * 0.75;
        desired.set(cp.x + Math.sin(a) * 4.5, cp.y + 1.6, cp.z + Math.cos(a) * 4.5);
        look.set(cp.x, cp.y, cp.z); lerpK = 2; fov = 42;
      }
    } else {
      const d = this.freeDist;
      desired.set(cp.x + Math.sin(this.freeYaw) * Math.cos(this.freePitch) * d, cp.y + Math.sin(this.freePitch) * d + 0.2, cp.z + Math.cos(this.freeYaw) * Math.cos(this.freePitch) * d);
      look.set(cp.x, cp.y + 0.15, cp.z); lerpK = 8; fov = 50;
    }

    this._groundClamp(desired, this.mode === 2 ? 0.12 : 0.3);
    if (this.modeT < 1) lerpK = Math.min(lerpK, 2 + this.modeT * 6);   // ease into a new mode
    const k = 1 - Math.exp(-lerpK * dt);
    this.pos.lerp(desired, k);
    this._groundClamp(this.pos, this.mode === 2 ? 0.1 : 0.25);
    this.look.lerp(look, 1 - Math.exp(-8 * dt));
    // terrain shake from suspension activity
    const act = phys.stats.suspension || 0;
    this.shake += (Math.min(1, act * 0.6 + (phys.stats.impact || 0)) - this.shake) * Math.min(1, dt * 6);
    const s = this.shake * 0.012 * (this.mode === 3 && this.cine.shot === 0 ? 0.2 : 1);
    const t = performance.now() * 0.001;
    this.cam.position.set(this.pos.x + Math.sin(t * 31) * s, this.pos.y + Math.sin(t * 37 + 1) * s, this.pos.z + Math.cos(t * 29) * s);
    this.cam.lookAt(this.look);
    this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 2);
    this.cam.updateProjectionMatrix();
    this.focusDist = this.cam.position.distanceTo(cp);
  }

  // mounted on the truck: glides there from wherever the camera was for the first moments, then stays fixed to it
  _mounted(dt, car, phys, view) {
    car.updateMatrixWorld();
    const v = mountedView(MOUNTED[this.mode], car, view);
    const k = this.modeT < 0.8 ? 1 - Math.exp(-(3 + this.modeT * 25) * dt) : 1;
    this.pos.lerp(v.pos, k); this.look.lerp(v.look, k);
    this.cam.up.lerp(v.up, k).normalize();
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
    this.cam.fov += (v.fov - this.cam.fov) * Math.min(1, dt * 4);
    this.cam.updateProjectionMatrix();
    this.focusDist = this.cam.position.distanceTo(_ml.copy(v.look));
    this.shake = 0;
  }
}
