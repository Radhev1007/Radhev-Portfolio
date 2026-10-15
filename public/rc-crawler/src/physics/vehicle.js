// RC crawler rigid-body physics: one sprung chassis body, 4 swept-cylinder wheels against the heightfield,
// soft suspension springs, impulse-based tyre friction coupled to a single locked-diff drivetrain,
// brushed-motor torque curve with ESC drag brake, penalty contacts for chassis/bumpers/roof and tree trunks.
import * as THREE from 'three';
import { SURF, SURF_PROPS, SURF_NAMES } from '../terrain/heightfield.js';

const V = () => new THREE.Vector3();
const _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V(), _v5 = V(), _n = V(), _p = V(), _r = V();
const _q = new THREE.Quaternion();
const _m3 = new THREE.Matrix3();

export const PHYS = {
  gravity: 30,
  mass: 1,
  wheelRadius: 0.2,
  wheelHalfWidth: 0.085,
  hubMin: -0.205,      // full droop (local y)
  travel: 0.19,        // compression range from droop
  hubRestY: -0.10,
  spring: 52,
  preload: 0.045,
  damp: 3.2,
  bumpK: 1400, bumpD: 30,
  chassisK: 1600, chassisD: 36, chassisMu: 0.55,
  driveInertia: 0.06,
  transInertia: 0.04,   // motor + transmission (reflected to wheel speed)
  wheelInertia: 0.005,  // each wheel + axle shaft
};

// wheel mounts (local), order FL, FR, RL, RR. +X = left, +Z = forward
const MOUNTS = [[0.34, 0.56], [-0.34, 0.56], [0.34, -0.56], [-0.34, -0.56]];

// chassis/body collision probe points (local)
const PROBES = [
  [0, -0.15, 0.05], [0.16, -0.12, 0.3], [-0.16, -0.12, 0.3], [0.16, -0.12, -0.3], [-0.16, -0.12, -0.3], // skid / frame
  [0, -0.11, 0.56], [0, -0.11, -0.56],         // diff pumpkins
  [0.22, 0.03, 0.79], [-0.22, 0.03, 0.79], [0, 0.0, 0.79],       // front bumper
  [0.25, 0.0, -0.8], [-0.25, 0.0, -0.8], [0, 0.17, -0.95],        // rear bumper, spare
  [0.4, 0.12, 0.62], [-0.4, 0.12, 0.62], [0.4, 0.12, -0.62], [-0.4, 0.12, -0.62], // fender corners
  [0.42, 0.06, 0], [-0.42, 0.06, 0],            // rock sliders
  [0.3, 0.46, 0.13], [-0.3, 0.46, 0.13], [0.3, 0.46, -0.74], [-0.3, 0.46, -0.74], // roof corners
  [0.33, 0.26, 0.72], [-0.33, 0.26, 0.72], [0, 0.53, -0.3],        // fender noses, roof rack top
];

// differential modes: [frontLocked, rearLocked]
export const DIFF_MODES = [
  { name: 'LOCKED', label: 'Locked', front: true, rear: true },
  { name: 'FRONT OPEN', label: 'Front open', front: false, rear: true },
  { name: 'OPEN', label: 'Open', front: false, rear: false },
];

export const GEARS = {
  LOW: { name: 'L', wmax: 14.8, tstall: 11.5 },
  HIGH: { name: 'H', wmax: 31, tstall: 7.2 },
};

export class CrawlerPhysics {
  constructor(hf) {
    this.hf = hf;
    this.pos = V(); this.q = new THREE.Quaternion();
    this.vel = V(); this.ang = V();
    const m = PHYS.mass;
    // inertia of a low, heavy-axled crawler (box-ish, scaled)
    this.Ib = new THREE.Vector3(m * 0.30, m * 0.33, m * 0.11);
    this.omega = 0;        // transmission output speed (in wheel rad/s)
    this.diffMode = 0;     // index into DIFF_MODES
    this.dig = false;      // rear driveshaft locked (front-only drive, pivot turns)
    this.throttle = 0;     // smoothed -1..1
    this.steer = 0;        // radians
    this.maxSteer = 0.58;
    this.gear = GEARS.LOW;
    this.handbrake = false;
    this.battery = 1;
    this.motorTemp = 0.25;
    this.wheels = MOUNTS.map(([x, z], i) => ({
      i, mx: x, mz: z, c: PHYS.hubRestY - PHYS.hubMin, cPrev: PHYS.hubRestY - PHYS.hubMin, cVis: PHYS.hubRestY - PHYS.hubMin,
      contact: false, n: V(0, 1, 0), p: V(), fn: 0, slip: 0, surf: SURF.DIRT, spin: 0, water: 0, load: 0,
      hub: V(), om: 0,
    }));
    this.trunks = [];       // [{x,z,r}]
    this.stats = { speed: 0, slip: 0, grounded: 0, load: 0, surface: 'dirt', water: 0, impact: 0, scrape: 0, suspension: 0, traction: 1, stress: 0 };
    this.events = [];      // impact events for audio/particles
    this.upsideTimer = 0;
    this.accum = 0;
    this.dt = 1 / 360;
  }

  reset(pos, yaw) {
    this.pos.copy(pos);
    this.q.setFromAxisAngle(_v1.set(0, 1, 0), yaw);
    this.vel.set(0, 0, 0); this.ang.set(0, 0, 0); this.omega = 0; this.throttle = 0;
    for (const w of this.wheels) w.om = 0;
    for (const w of this.wheels) { w.c = w.cPrev = w.cVis = PHYS.hubRestY - PHYS.hubMin; w.contact = false; }
    this.upsideTimer = 0;
  }

  // place upright at x,z with given yaw, resting just above the ground
  placeAt(x, z, yaw) {
    let maxH = -1e9;
    for (let dx = -0.6; dx <= 0.6; dx += 0.2) for (let dz = -1; dz <= 1; dz += 0.2) maxH = Math.max(maxH, this.hf.heightAt(x + dx, z + dz));
    this.reset(_v5.set(x, maxH + 0.42, z), yaw);
  }

  get yaw() { _v1.set(0, 0, 1).applyQuaternion(this.q); return Math.atan2(_v1.x, _v1.z); }
  get up() { return _v2.set(0, 1, 0).applyQuaternion(this.q); }

  // world inverse inertia applied to vector
  _applyInvI(t, out) {
    // out = R * Ib^-1 * R^T * t
    _q.copy(this.q).invert();
    out.copy(t).applyQuaternion(_q);
    out.x /= this.Ib.x; out.y /= this.Ib.y; out.z /= this.Ib.z;
    return out.applyQuaternion(this.q);
  }

  _pointVel(p, out) { return out.copy(p).sub(this.pos).cross(this.ang).negate().add(this.vel); } // v + w x r

  _applyImpulse(J, p) {
    this.vel.addScaledVector(J, 1 / PHYS.mass);
    _r.copy(p).sub(this.pos).cross(J);
    this._applyInvI(_r, _v4);
    this.ang.add(_v4);
  }
  _applyForce(F, p, dt) { _v3.copy(F).multiplyScalar(dt); this._applyImpulse(_v3, p); }

  _effMass(p, dir) {
    _r.copy(p).sub(this.pos);
    _v4.copy(_r).cross(dir);
    this._applyInvI(_v4, _v5);
    _v5.cross(_r);
    return 1 / (1 / PHYS.mass + dir.dot(_v5));
  }

  update(dt, input) {
    // input smoothing
    const tgt = input.throttle;
    const rate = Math.abs(tgt) > Math.abs(this.throttle) ? 2.2 : 4.5;
    this.throttle += Math.sign(tgt - this.throttle) * Math.min(Math.abs(tgt - this.throttle), rate * dt);
    const steerTgt = input.steer * this.maxSteer;
    const prevSteer = this.steer;
    this.steer += Math.sign(steerTgt - this.steer) * Math.min(Math.abs(steerTgt - this.steer), 2.6 * dt);
    this.steerRate = (this.steer - prevSteer) / Math.max(dt, 1e-4);
    this.handbrake = input.handbrake;

    this.accum += Math.min(dt, 0.05);
    let steps = 0;
    this.stats.impact = 0; this.stats.scrape = 0;
    while (this.accum >= this.dt && steps < 14) { this._step(this.dt); this.accum -= this.dt; steps++; }

    // derived stats
    const fwd = _v1.set(0, 0, 1).applyQuaternion(this.q);
    let g = 0, slip = 0, load = 0, water = 0; const surfCount = {};
    for (const w of this.wheels) {
      if (w.contact) { g++; slip += Math.min(1, Math.abs(w.slip) / 1.5); load += w.fn; const s = SURF_PROPS[w.surf].audio; surfCount[s] = (surfCount[s] || 0) + 1; }
      water += w.water;
      // visual compression smoothing (wheel droops when unloaded)
      const target = w.contact ? w.c : 0;
      w.cVis += (target - w.cVis) * Math.min(1, dt * (w.contact ? 60 : 9));
      w.spin += w.om * dt;
    }
    let surf = 'dirt', best = 0; for (const k in surfCount) if (surfCount[k] > best) { best = surfCount[k]; surf = k; }
    const s = this.stats;
    s.speed = this.vel.dot(fwd);
    s.slip = g ? slip / g : 0;
    s.grounded = g / 4;
    s.load = Math.min(1, Math.abs(this.motorTorque || 0) / this.gear.tstall);
    s.surface = water / 4 > 0.25 ? 'water' : surf;
    s.water = water / 4;
    s.traction = g ? Math.max(0, 1 - s.slip) * (g / 4) : 0;
    const up = this.up;
    if (up.y < 0.3) this.upsideTimer += dt; else this.upsideTimer = Math.max(0, this.upsideTimer - dt * 2);
    // battery + motor temperature
    const draw = Math.abs(this.throttle) * (0.25 + s.load * 0.75);
    this.battery = Math.max(0, this.battery - draw * dt * 0.0009);
    this.motorTemp += (0.25 + draw * 0.8 - this.motorTemp) * dt * 0.03;
  }

  _step(dt) {
    const hf = this.hf;
    const q = this.q;
    const up = _v1.set(0, 1, 0).applyQuaternion(q).clone();
    const fwdC = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const leftC = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const R = PHYS.wheelRadius, HW = PHYS.wheelHalfWidth;

    // ---- gravity
    this.vel.y -= PHYS.gravity * dt;

    // ---- motor / drivetrain
    const gear = this.gear;
    let u = this.throttle;
    const batt = 0.82 + 0.18 * this.battery;
    let braking = this.handbrake;
    if (Math.abs(u) < 0.04) braking = true;                       // ESC drag brake
    if (u < -0.04 && this.omega > 0.8) { braking = true; u = 0; }   // brake before reversing
    if (u > 0.04 && this.omega < -0.8) { braking = true; u = 0; }
    if (u < 0) u *= 0.75;
    let T = 0;
    if (!braking || Math.abs(u) > 0.04) T = gear.tstall * batt * (u - this.omega / gear.wmax);
    T -= 0.15 * this.omega; // gear friction
    this.motorTorque = T;
    const It = PHYS.transInertia, Iw = PHYS.wheelInertia;
    this.omega += (T / It) * dt;
    if (braking) {
      const maxD = (this.handbrake ? 30 : 22) / PHYS.driveInertia * dt;
      this.omega -= Math.sign(this.omega) * Math.min(Math.abs(this.omega), maxD);
      if (this.handbrake) for (const w of this.wheels) w.om -= Math.sign(w.om) * Math.min(Math.abs(w.om), maxD);
    }

    // ---- wheel contacts
    const steerL = this.steer * (this.steer > 0 ? 1.08 : 0.92), steerR = this.steer * (this.steer > 0 ? 0.92 : 1.08);
    for (const w of this.wheels) {
      const front = w.mz > 0;
      const st = front ? (w.mx > 0 ? steerL : steerR) : 0;
      // wheel axes
      const fwd = _v2.copy(fwdC).applyAxisAngle(up, st).clone();
      const axle = new THREE.Vector3().crossVectors(up, fwd); // points left
      // hub at full droop
      const Hd = new THREE.Vector3(w.mx, PHYS.hubMin, w.mz).applyQuaternion(q).add(this.pos);
      w.hub.copy(Hd);
      let cMax = -1, bestP = null, frontPen = 0, frontN = null;
      w.water = 0;
      for (let ai = -1; ai <= 1; ai++) {
        const a = ai * HW * 0.85;
        for (let fi = -7; fi <= 7; fi++) {
          const f = fi * (R / 7) * 1.02;
          const sx = Hd.x + fwd.x * f + axle.x * a + up.x * 0.05;
          const sz = Hd.z + fwd.z * f + axle.z * a + up.z * 0.05;
          const h = hf.heightAt(sx, sz);
          const Dx = sx - Hd.x, Dy = h - Hd.y, Dz = sz - Hd.z;
          const Du = Dx * up.x + Dy * up.y + Dz * up.z;
          const Df = Dx * fwd.x + Dy * fwd.y + Dz * fwd.z;
          if (Math.abs(Df) >= R) continue;
          const half = Math.sqrt(R * R - Df * Df);
          if (Du > PHYS.travel + 0.02) {
            // obstacle above the max-compressed hub: frontal hit against the tyre face
            const pen = R - Math.abs(Df);
            if (pen > frontPen && Du < PHYS.travel + R * 1.6) { frontPen = pen; frontN = fwd.clone().multiplyScalar(-Math.sign(Df)); }
            continue;
          }
          const ck = Du + half;
          if (ck > cMax) { cMax = ck; bestP = _p.set(sx, h, sz).clone(); }
        }
      }
      const wd = hf.waterDepthAt(Hd.x, Hd.z);
      w.water = Math.min(1, wd / (R * 1.6));
      if (cMax > 0 && bestP) {
        w.surf = hf.surfaceAt(bestP.x, bestP.z);
        const props = SURF_PROPS[w.surf];
        // sinkage in soft surfaces
        const c = Math.max(0, cMax - props.sink);
        w.contact = c > 0;
        if (!w.contact) { w.fn = 0; w.c = 0; w.cPrev = Math.max(0, w.cPrev - dt * 2); continue; }
        const cc = Math.min(c, PHYS.travel);
        const Hc = _v3.copy(Hd).addScaledVector(up, cc);
        const n = _n.copy(Hc).sub(bestP);
        // if beyond bump-stop the hub can't rise; normal still from contact to hub centre
        if (n.lengthSq() < 1e-8) n.copy(up); n.normalize();
        // blend with terrain normal for smoothness on flat-ish ground
        const tn = hf.normalAt(bestP.x, bestP.z, _v4);
        n.lerp(tn, 0.35).normalize();
        if (n.dot(up) < 0.05) n.addScaledVector(up, 0.2).normalize();
        w.n.copy(n); w.p.copy(bestP);
        w.cp = (w.cp || new THREE.Vector3()).copy(Hc).addScaledVector(n, -R);
        w.axle = (w.axle || new THREE.Vector3()).copy(axle);
        // spring + damper along chassis up
        const cv = THREE.MathUtils.clamp((cc - w.cPrev) / dt, -1.2, 1.2);
        w.cPrev = cc; w.c = cc;
        let Fs = PHYS.spring * (cc + PHYS.preload) + PHYS.damp * cv;
        if (Fs < 0) Fs = 0;
        // bump stop / rigid overlap
        let Fb = 0;
        if (c > PHYS.travel) {
          const e = c - PHYS.travel;
          const pv = this._pointVel(Hc, _v5).dot(n);
          Fb = PHYS.bumpK * e - PHYS.bumpD * Math.min(0, pv);
          if (e > 0.01) this.stats.impact = Math.max(this.stats.impact, Math.min(1, -pv * 0.25));
          this.stats.stress = Math.max(this.stats.stress * 0.999, Math.min(1, e * 8));
        }
        const N = Fs / Math.max(0.35, n.dot(up)) + Fb;
        w.fn = N;
        const F = _v4.copy(n).multiplyScalar(N);
        const app = Hc.clone().addScaledVector(n, -R * 0.6);
        this._applyForce(F, app, dt);
        w.fwd = fwd; w.app = app;
      } else {
        w.contact = false; w.fn = 0; w.c = 0; w.cPrev = Math.max(0, w.cPrev - dt * 2);
      }
      if (frontPen > 0.002) {
        // tyre face pressed into a wall
        const Hc = Hd.clone().addScaledVector(up, Math.max(0, w.c));
        const pv = this._pointVel(Hc, _v5).dot(frontN);
        const Ff = Math.max(0, 900 * frontPen - 20 * Math.min(0, pv));
        this._applyForce(_v4.copy(frontN).multiplyScalar(Ff), Hc, dt);
        this.stats.impact = Math.max(this.stats.impact, Math.min(1, -pv * 0.2));
      }
    }

    // ---- driveline couplings (velocity constraints between transmission, axles and wheels)
    const W = this.wheels, mode = DIFF_MODES[this.diffMode] || DIFF_MODES[0], dig = this.dig;
    const couple = () => {
      for (const [a, b, locked, rear] of [[0, 1, mode.front, false], [2, 3, mode.rear, true]]) {
        const wa = W[a], wb = W[b];
        // locked diff (spool): both wheels turn together
        if (locked) { const l = -(wa.om - wb.om) / (2 / Iw); wa.om += l / Iw; wb.om -= l / Iw; }
        const c = (wa.om + wb.om) / 2;
        if (rear && dig) {
          // dig: rear driveshaft locked -> rear carrier held still, transmission drives the front only
          const l = -c / (0.5 / Iw); wa.om += 0.5 * l / Iw; wb.om += 0.5 * l / Iw;
        } else {
          // carrier follows the transmission output (centre is always locked on a crawler)
          const l = -(c - this.omega) / (0.5 / Iw + 1 / It);
          wa.om += 0.5 * l / Iw; wb.om += 0.5 * l / Iw; this.omega -= l / It;
        }
      }
    };

    // ---- tyre friction impulses (Gauss-Seidel), each wheel with its own spin
    const ITER = 4;
    for (let it = 0; it < ITER; it++) {
      couple();
      for (const w of this.wheels) {
        if (!w.contact) { w.slip = w.om * R; continue; }
        const props = SURF_PROPS[w.surf];
        const wetMu = 1 - (hf.wetGlobal || 0) * (w.surf === SURF.ROCK ? 0.3 : 0.18) - w.water * 0.12;
        const mu = props.mu * wetMu * (0.92 + 0.08 * this.battery);
        const n = w.n;
        const tl = _v1.copy(w.fwd).addScaledVector(n, -w.fwd.dot(n)).normalize();
        const tt = _v2.crossVectors(n, tl).normalize();
        const p = w.app;
        const vp = this._pointVel(p, _v3);
        const vl = vp.dot(tl), vt = vp.dot(tt);
        const slip = w.om * R - vl;
        w.slip = slip;
        const ml = this._effMass(p, tl), mt = this._effMass(p, tt);
        const maxJ = mu * w.fn * dt / ITER;
        // longitudinal: wheel inertia boosted by what the driveline couples to it
        const Ieff = Iw * (mode.front && mode.rear && !dig ? 4 + It / Iw : 2) * 0.25;
        let Jl = slip / (1 / ml + R * R / Ieff);
        let Jroll = -Math.sign(vl) * Math.min(Math.abs(vl) * ml, props.roll * w.fn * dt / ITER);
        let Jt = -vt * mt * 0.9 * (2 / ITER);
        const mag = Math.hypot(Jl, Jt);
        if (mag > maxJ) { const sc = maxJ / mag; Jl *= sc; Jt *= sc; }
        const J = _v4.copy(tl).multiplyScalar(Jl + Jroll).addScaledVector(tt, Jt);
        this._applyImpulse(J, p);
        w.om -= Jl * R / Iw;
      }
    }
    couple();
    // unloaded wheels slowly lose speed (bearing drag)
    for (const w of this.wheels) if (!w.contact) w.om *= 1 - 0.4 * dt;

    // ---- chassis probes (bumpers, skid, body, roof)
    for (const pr of PROBES) {
      const P = _p.set(pr[0], pr[1], pr[2]).applyQuaternion(q).add(this.pos);
      const h = hf.heightAt(P.x, P.z);
      if (P.y < h) {
        const n = hf.normalAt(P.x, P.z, _n);
        const e = (h - P.y) * Math.max(0.25, n.y);
        const vp = this._pointVel(P, _v3);
        const vn = vp.dot(n);
        const Fn = Math.max(0, PHYS.chassisK * e - PHYS.chassisD * Math.min(0, vn));
        _v4.copy(n).multiplyScalar(Fn);
        // kinetic friction
        const vt = _v5.copy(vp).addScaledVector(n, -vn);
        const vtl = vt.length();
        if (vtl > 1e-4) _v4.addScaledVector(vt, -Math.min(PHYS.chassisMu * Fn, vtl * 40) / vtl);
        this._applyForce(_v4, P, dt);
        if (vn < -0.4) this.events.push({ kind: pr[1] > 0.3 ? 'thud' : 'rock', strength: Math.min(1, -vn * 0.35), p: P.clone() });
        if (vtl > 0.3) this.stats.scrape = Math.max(this.stats.scrape, Math.min(1, vtl * 0.4));
      }
      // tree trunks
      for (const t of this.trunks) {
        const dx = P.x - t.x, dz = P.z - t.z, d2 = dx * dx + dz * dz;
        if (d2 < t.r * t.r && P.y < t.top) {
          const d = Math.sqrt(d2) || 1e-3;
          const pen = t.r - d;
          const n = _n.set(dx / d, 0, dz / d);
          const vn = this._pointVel(P, _v3).dot(n);
          this._applyForce(_v4.copy(n).multiplyScalar(Math.max(0, 2000 * pen - 30 * Math.min(0, vn))), P, dt);
          if (vn < -0.4) this.events.push({ kind: 'rock', strength: Math.min(1, -vn * 0.3), p: P.clone() });
        }
      }
    }

    // ---- water drag + slight buoyancy
    const depth = hf.waterDepthAt(this.pos.x, this.pos.z);
    if (depth > 0) {
      const sub = Math.min(1, depth / 0.7);
      this.vel.multiplyScalar(1 - sub * 1.6 * dt);
      this.vel.y += sub * PHYS.gravity * 0.18 * dt;
      this.ang.multiplyScalar(1 - sub * 1.2 * dt);
    }

    // ---- light damping
    this.ang.multiplyScalar(1 - 0.35 * dt);
    this.vel.multiplyScalar(1 - 0.02 * dt);

    // ---- integrate
    this.pos.addScaledVector(this.vel, dt);
    const w = this.ang;
    _q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q);
    q.x += _q.x; q.y += _q.y; q.z += _q.z; q.w += _q.w; q.normalize();

    // keep inside world
    const lim = hf.half - 2;
    if (Math.abs(this.pos.x) > lim || Math.abs(this.pos.z) > lim) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
      this.vel.multiplyScalar(0.5);
    }
    // safety: never fall through the world
    const gh = hf.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y < gh - 0.6) { this.pos.y = gh + 0.5; this.vel.set(0, 0, 0); }
  }

  // body corner points (world xz) for marker-touch tests
  cornerPoints() {
    const out = [];
    for (const [x, z] of [[0.43, 0.86], [-0.43, 0.86], [0.43, -0.84], [-0.43, -0.84], [0.45, 0.56], [-0.45, 0.56], [0.45, -0.56], [-0.45, -0.56], [0.43, 0], [-0.43, 0]]) {
      out.push(new THREE.Vector3(x, 0, z).applyQuaternion(this.q).add(this.pos));
    }
    return out;
  }

  // hub local Y per wheel for the visual model
  hubLocalY(i) { return PHYS.hubMin + this.wheels[i].cVis; }
}
