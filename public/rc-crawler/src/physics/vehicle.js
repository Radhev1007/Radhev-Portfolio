// RC crawler rigid-body physics: one sprung chassis body, 4 swept-cylinder wheels against the heightfield,
// soft suspension springs, impulse-based tyre friction coupled to a single locked-diff drivetrain,
// brushed-motor torque curve with ESC drag brake. Hard contacts (chassis vs ground, body and wheels vs tree
// trunks, tyre faces vs walls, suspension bump stops) go through a sequential-impulse solver with low
// restitution and split-impulse penetration recovery, so crashes stop the truck instead of bouncing it.
import * as THREE from 'three';
import { SURF, SURF_PROPS, SURF_NAMES } from '../terrain/heightfield.js';

const V = () => new THREE.Vector3();
const _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V(), _v5 = V(), _n = V(), _p = V(), _r = V();
const _tdir = V(); // contact solver's friction direction: _effMass overwrites _v4/_v5
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
  // contact solver
  restitution: 0.1,     // a steel-and-plastic truck hitting rock or wood barely rebounds
  restMinV: 0.8,        // below this closing speed, contacts are fully inelastic (no micro-bounce)
  slop: 0.004,          // allowed penetration before position recovery kicks in
  beta: 0.2,            // fraction of penetration recovered per substep (split impulse, adds no velocity)
  // breakable marker stakes. Two ways to snap one: an impact faster than stakeSnapV, or sustained
  // pushing: contact impulse accumulates as stress fading with stakeHalfLife, and past stakeLimit it
  // breaks. Measured stuck-push force is ~16 N at 15% throttle, ~30 N at 40%, ~65 N at full, so a
  // stuck truck snaps the stake after ~1 s, ~0.4 s and ~0.15 s; a gentle bump holds.
  stakeSnapV: 1.0,      // m/s closing speed
  stakeLimit: 9,        // N·s of accumulated impulse
  stakeHalfLife: 0.5,   // s
  stakePushTime: 0.4,   // s of contact with the throttle held before a post gives way regardless of force
};

// Collision boxes in body space, measured from the rendered model (wheels excluded), against upright
// posts: tree trunks, marker stakes, gate and sign posts. [half width, y0, y1, z0, z1, part]
const BOXES = [
  [0.38, 0.05, 0.29, 0.24, 0.74, 'body'],     // hood and front fenders
  [0.38, 0.05, 0.44, -0.80, 0.24, 'body'],    // cab and tub
  [0.35, 0.44, 0.56, -0.80, 0.21, 'roof'],    // roof rack (only where the rack actually is)
  [0.34, -0.14, 0.05, -0.40, 0.32, 'skid'],   // frame rails and skid plate between the axles
  [0.24, -0.10, 0.06, 0.66, 0.82, 'bumper'],  // front bumper
  [0.29, -0.10, 0.05, -0.86, -0.70, 'bumper'],// rear bumper
  [0.10, 0.00, 0.41, -0.94, -0.80, 'body'],   // spare tyre on the tailgate
];
// footprint corners for buoyancy
const BODY_X = 0.38, BODY_ZF = 0.82, BODY_ZR = -0.86;

// wheel mounts (local), order FL, FR, RL, RR. +X = left, +Z = forward
const MOUNTS = [[0.34, 0.56], [-0.34, 0.56], [0.34, -0.56], [-0.34, -0.56]];

// chassis/body collision probe points (local); PROBE_PART names what each one is, for impact sounds
const PROBE_PART = ['skid', 'skid', 'skid', 'skid', 'skid', 'skid', 'skid', 'bumper', 'bumper', 'bumper', 'bumper', 'bumper', 'bumper',
  'body', 'body', 'body', 'body', 'body', 'body', 'roof', 'roof', 'roof', 'roof', 'body', 'body', 'roof'];
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

// wmax: free-running wheel speed (rad/s); tstall: torque at stall; fric: drivetrain friction per rad/s.
// Low range is the crawler gear (~1.3 km/h scale speed). High range is the trail gear: ~4.5-5 km/h on the flat.
export const GEARS = {
  LOW: { name: 'L', wmax: 22, tstall: 14, fric: 0.15 },
  HIGH: { name: 'H', wmax: 78, tstall: 12, fric: 0.02 },
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
    this.dragBrake = 1;    // ESC drag brake strength when the throttle is released: 0 = coast freely .. 1 = full
    this.battery = 1;
    this.motorTemp = 0.25;
    this.wheels = MOUNTS.map(([x, z], i) => ({
      i, mx: x, mz: z, c: PHYS.hubRestY - PHYS.hubMin, cPrev: PHYS.hubRestY - PHYS.hubMin, cVis: PHYS.hubRestY - PHYS.hubMin,
      contact: false, n: V(0, 1, 0), p: V(), fn: 0, slip: 0, surf: SURF.DIRT, spin: 0, water: 0, load: 0,
      hub: V(), om: 0,
    }));
    this.trunks = [];       // [{x,z,r}]
    this.stats = { speed: 0, slip: 0, slide: 0, grounded: 0, load: 0, surface: 'dirt', water: 0, impact: 0, scrape: 0, scrapeMat: 'dirt', suspension: 0, traction: 1, stress: 0 };
    // Physics events for audio/particles, consumed (and cleared) by the game each frame:
    //   hit      {mat, part, speed, impulse, p}  a contact closing at speed (collisions, tumbles)
    //   touch    {wheel, mat, speed, air, p}     a tyre landing after being off the ground
    //   release  {wheel, c, p}                   a tyre leaving the ground
    //   takeoff  {up, p} / land {air, speed, p}  the whole truck leaving / regaining the ground
    this.events = [];
    this.airT = 0;          // time with no wheel or body contact
    this.upsideTimer = 0;
    this.accum = 0;
    this.dt = 1 / 360;
    this.contacts = [];
    this.posts = [];         // marker stakes, gate and sign posts: [{x,z,r,y0,top,mat,kind,id,enabled}]
    this.touched = new Set();// posts in contact during the last update (challenge rules read this)
    this.vPs = V(); this.wPs = V();                          // split-impulse pseudo velocities
    this.prevPos = V(); this.prevQ = new THREE.Quaternion();  // previous substep, for render interpolation
  }

  reset(pos, yaw) {
    this.pos.copy(pos);
    this.q.setFromAxisAngle(_v1.set(0, 1, 0), yaw);
    this.vel.set(0, 0, 0); this.ang.set(0, 0, 0); this.omega = 0; this.throttle = 0;
    for (const w of this.wheels) w.om = 0;
    for (const w of this.wheels) { w.c = w.cPrev = w.cVis = PHYS.hubRestY - PHYS.hubMin; w.contact = false; w.bumpF = 0; }
    this.upsideTimer = 0;
    this.vPs.set(0, 0, 0); this.wPs.set(0, 0, 0);
    this.prevPos.copy(this.pos); this.prevQ.copy(this.q);
    this.accum = 0;
  }

  // pose for drawing: blends the last two substeps by the leftover accumulator, so the model moves
  // smoothly instead of snapping to whichever substep a frame happened to land on
  renderPose(outPos, outQ) {
    const a = THREE.MathUtils.clamp(this.accum / this.dt, 0, 1);
    outPos.copy(this.prevPos).lerp(this.pos, a);
    outQ.copy(this.prevQ).slerp(this.q, a);
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
  // contact point velocity relative to what it touches: an obstacle that moves itself (another player's
  // truck, c.ov = its velocity) closes or opens the gap too; static ground and posts have no c.ov
  _relVel(c, out) { this._pointVel(c.p, out); if (c.ov) out.sub(c.ov); return out; }

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
    // posts touched during the previous frame's substeps, before the set is refilled for this frame
    const prevTouched = this._prevTouched || (this._prevTouched = new Set());
    prevTouched.clear(); for (const t of this.touched) prevTouched.add(t);
    this.touched.clear();
    // stake stress fades between hits; past the limit the stake snaps and stops colliding
    const decay = Math.pow(0.5, Math.min(dt, 0.05) / PHYS.stakeHalfLife);
    for (const t of this.posts) {
      if (!t.breakable || t.broken) continue;
      // driving into a post with the throttle held: on a slope with the wheels spinning the push can be
      // too weak to reach the force limit, so being stuck against it for long enough breaks it anyway
      if (prevTouched.has(t) && Math.abs(this.throttle) > 0.1) t.pushT = (t.pushT || 0) + Math.min(dt, 0.05);
      else t.pushT = Math.max(0, (t.pushT || 0) - Math.min(dt, 0.05) * 2);
      if ((t.pushT || 0) > (t.pushTime ?? PHYS.stakePushTime)) t.stress = Infinity;
      if (!t.stress) continue;
      // per-post limits: steel signs and gate posts (snapV 1.5, limit 14) are tougher than fibreglass stakes
      if (t.stress > (t.limit ?? PHYS.stakeLimit) || (t.hitV || 0) > (t.snapV ?? PHYS.stakeSnapV)) {
        t.broken = true; t.enabled = false;
        t.fallDir = new THREE.Vector3(-(t.pushN?.x || 0), 0, -(t.pushN?.z || 0));
        if (t.fallDir.lengthSq() < 1e-6) t.fallDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        t.fallDir.normalize();
        this.events.push({ type: 'break', mat: t.mat, speed: t.hitV || 0, p: new THREE.Vector3(t.x, t.y0 + 0.15, t.z), post: t });
      } else { t.stress *= decay; t.hitV = (t.hitV || 0) * decay; }
    }
    while (this.accum >= this.dt && steps < 14) {
      this.prevPos.copy(this.pos); this.prevQ.copy(this.q);
      this._step(this.dt); this.accum -= this.dt; steps++;
    }
    // A slow frame can't be caught up in one go; carrying the backlog forward made the truck run in
    // slow motion and then lurch ahead. Drop it instead.
    if (this.accum > this.dt) this.accum = this.dt;

    // derived stats
    const fwd = _v1.set(0, 0, 1).applyQuaternion(this.q);
    let g = 0, slip = 0, slide = 0, load = 0, water = 0; const surfCount = {};
    for (const w of this.wheels) {
      if (w.contact) { g++; slip += Math.min(1, Math.abs(w.slip) / 1.5); slide += Math.abs(w.vt || 0); load += w.fn; const s = SURF_PROPS[w.surf].audio; surfCount[s] = (surfCount[s] || 0) + 1; }
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
    s.slide = g ? slide / g : 0;
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

    this.contacts.length = 0;
    for (const w of this.wheels) w.was = w.contact;

    // ---- gravity
    this.vel.y -= PHYS.gravity * dt;

    // ---- motor / drivetrain
    const gear = this.gear;
    let u = this.throttle;
    const batt = 0.82 + 0.18 * this.battery;
    let braking = this.handbrake;
    // throttle released: the ESC drag brake (strength set by the player) slows the motor and holds the truck on a
    // slope; with it off the motor is left unpowered and the truck coasts / rolls
    const coasting = Math.abs(u) < 0.04 && !this.handbrake;
    if (coasting && this.dragBrake > 0) braking = true;
    if (u < -0.04 && this.omega > 0.8) { braking = true; u = 0; }   // brake before reversing
    if (u > 0.04 && this.omega < -0.8) { braking = true; u = 0; }
    if (u < 0) u *= 0.75;
    let T = 0;
    if (!coasting && (!braking || Math.abs(u) > 0.04)) T = gear.tstall * batt * (u - this.omega / gear.wmax);
    // a motor spun past its free speed (shifting into low range at speed) brakes, but no harder than its
    // stall torque: otherwise a downshift from top speed would stop the wheels dead and flip the truck
    T = Math.max(T, -gear.tstall);
    T -= gear.fric * this.omega; // gear friction
    this.motorTorque = T;
    const It = PHYS.transInertia, Iw = PHYS.wheelInertia;
    this.omega += (T / It) * dt;
    if (braking) {
      const maxD = (this.handbrake ? 30 : coasting ? 22 * this.dragBrake : 22) / PHYS.driveInertia * dt;
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
      w.dirF = fwd; w.dirA = axle;
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
        // shock velocity: the old ±1.2 m/s clamp left hard landings under-damped, which is what
        // launched the truck back up after a drop. Rebound is damped harder than compression, as on a
        // real shock, so the body settles instead of pogoing.
        const cv = THREE.MathUtils.clamp((cc - w.cPrev) / dt, -4, 4);
        w.cPrev = cc; w.c = cc;
        let Fs = PHYS.spring * (cc + PHYS.preload) + PHYS.damp * cv * (cv < 0 ? 1.6 : 1);
        if (Fs < 0) Fs = 0;
        // bump stop: the suspension has run out of travel, so the chassis meets the axle rigidly. Solved
        // as a hard contact rather than a stiff spring (which stored the landing and threw it back).
        if (c > PHYS.travel) {
          const e = c - PHYS.travel;
          const pv = this._pointVel(Hc, _v5).dot(n);
          this.contacts.push({ p: bestP.clone(), n: n.clone(), e, mu: 0, wheel: w, part: 'bump', mat: SURF_NAMES[w.surf] || 'dirt' });
          if (e > 0.01) this.stats.impact = Math.max(this.stats.impact, Math.min(1, -pv * 0.25));
          this.stats.stress = Math.max(this.stats.stress * 0.999, Math.min(1, e * 8));
        } else w.bumpF = 0;
        // The spring/damper pushes the body; the bump stop is a solver contact, so its load only feeds
        // tyre grip here (re-applying it as a force kicked every hard landing back up).
        const N = Fs / Math.max(0.35, n.dot(up));
        w.fn = N + (w.bumpF || 0);
        const F = _v4.copy(n).multiplyScalar(N);
        const app = Hc.clone().addScaledVector(n, -R * 0.6);
        this._applyForce(F, app, dt);
        w.fwd = fwd; w.app = app;
      } else {
        w.contact = false; w.fn = 0; w.c = 0; w.cPrev = Math.max(0, w.cPrev - dt * 2);
      }
      if (frontPen > 0.002) {
        // tyre face pressed into a wall (log, ledge): a hard contact at the hub
        const Hc = Hd.clone().addScaledVector(up, Math.max(0, w.c));
        const pv = this._pointVel(Hc, _v5).dot(frontN);
        this.contacts.push({ p: Hc, n: frontN.clone(), e: frontPen, mu: 0.5, part: 'tyre', mat: SURF_NAMES[hf.surfaceAt(Hc.x, Hc.z)] || 'rock' });
        this.stats.impact = Math.max(this.stats.impact, Math.min(1, -pv * 0.2));
      }
    }

    // ---- moving platforms: each loaded wheel standing on one pushes its end down; it then steps
    if (hf.dyn) for (const d of hf.dyn) {
      for (const w of this.wheels) {
        if (!w.contact || !w.p) continue;
        const y = d.heightAt(w.p.x, w.p.z);
        if (y > -Infinity && Math.abs(y - w.p.y) < 0.05) d.load(w.p.x, w.p.z, w.fn);
      }
      d.step(dt);
      for (const e of d.events) if (this.events.length < 64) this.events.push(e);
      d.events.length = 0;
    }

    // ---- tyre touchdown / lift-off, per wheel, at the substep it happens
    for (const w of this.wheels) {
      if (w.contact) {
        if (!w.was && (w.air || 0) > 0.06) {
          const sp = -this._pointVel(w.hub, _v5).dot(w.n);
          this.events.push({ type: 'touch', wheel: w.i, mat: SURF_NAMES[w.surf] || 'dirt', speed: Math.max(0, sp), air: w.air, p: w.p.clone() });
        }
        w.air = 0; w.relC = w.c;
      } else {
        const a0 = w.air || 0;
        w.air = a0 + dt;
        if (a0 < 0.05 && w.air >= 0.05) this.events.push({ type: 'release', wheel: w.i, c: w.relC || 0, p: w.hub.clone() });
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
        if (it === 0) w.vt = vt;               // sideways tyre slide, for skid sounds
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

    // ---- chassis probes (bumpers, skid, body, roof) against the ground
    for (let pi = 0; pi < PROBES.length; pi++) {
      const pr = PROBES[pi];
      const P = _p.set(pr[0], pr[1], pr[2]).applyQuaternion(q).add(this.pos);
      const h = hf.heightAt(P.x, P.z);
      if (P.y < h) {
        const n = hf.normalAt(P.x, P.z, _n).clone();
        this.contacts.push({ p: P.clone(), n, e: (h - P.y) * Math.max(0.25, n.y), mu: PHYS.chassisMu, part: PROBE_PART[pi], mat: SURF_NAMES[hf.surfaceAt(P.x, P.z)] || 'dirt', scrape: true });
      }
    }

    // ---- upright posts (tree trunks, marker stakes, gate and sign posts) against the body boxes and the
    // four tyres. Each post is tested along its height, so a part only collides with what is level with
    // it: a stake shorter than the rack never touches the rack, the spare only where the spare is.
    _q.copy(q).invert();
    this._prevInvQ = (this._prevInvQ || new THREE.Quaternion()).copy(this.prevQ).invert();
    for (const list of [this.trunks, this.posts]) for (const t of list) {
      if (t.enabled === false) continue;
      const dx0 = t.x - this.pos.x, dz0 = t.z - this.pos.z;
      if (dx0 * dx0 + dz0 * dz0 > (1.4 + t.r) * (1.4 + t.r)) continue;
      this._postContacts(t, q, up, R, HW);
    }

    this._solveContacts(dt);

    // ---- whole-truck takeoff / landing (no wheel and no body contact = airborne)
    const touching = this.contacts.length > 0 || this.wheels.some((w) => w.contact);
    if (touching) {
      if (this.airT > 0.15) this.events.push({ type: 'land', air: this.airT, speed: Math.max(0, -(this._vyAir || 0)), p: this.pos.clone() });
      this.airT = 0;
    } else {
      const a0 = this.airT;
      this.airT += dt;
      this._vyAir = this.vel.y;            // vertical speed just before the next touchdown
      if (a0 < 0.08 && this.airT >= 0.08) this.events.push({ type: 'takeoff', up: Math.max(0, this.vel.y), p: this.pos.clone() });
    }

    // ---- water drag + buoyancy. Buoyancy acts at the four body corners in proportion to how deep each
    // is, so a truck entering water nose-first gets lifted at the nose and levels out; the old single
    // force at the centre had no righting moment, so it nose-dived.
    const depth = hf.waterDepthAt(this.pos.x, this.pos.z);
    if (depth > 0) {
      const sub = Math.min(1, depth / 0.7);
      this.vel.multiplyScalar(1 - sub * 1.6 * dt);
      this.ang.multiplyScalar(1 - sub * 1.2 * dt);
      for (const [x, z] of [[BODY_X, BODY_ZF - 0.15], [-BODY_X, BODY_ZF - 0.15], [BODY_X, BODY_ZR + 0.15], [-BODY_X, BODY_ZR + 0.15]]) {
        const P = _p.set(x, 0, z).applyQuaternion(q).add(this.pos);
        const dc = hf.waterDepthAt(P.x, P.z) - (P.y - hf.heightAt(P.x, P.z));
        if (dc > 0) this._applyForce(_v4.set(0, PHYS.gravity * 0.045 * Math.min(1, dc / 0.35), 0), P, dt);
      }
    }

    // ---- light damping
    this.ang.multiplyScalar(1 - 0.35 * dt);
    this.vel.multiplyScalar(1 - 0.02 * dt);

    // ---- integrate (real velocity, then the split-impulse pseudo velocity, which only repairs overlap
    // and is discarded so it can't add energy)
    this.pos.addScaledVector(this.vel, dt);
    const w = this.ang;
    _q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q);
    q.x += _q.x; q.y += _q.y; q.z += _q.z; q.w += _q.w; q.normalize();
    if (this.vPs.lengthSq() + this.wPs.lengthSq() > 0) {
      this.pos.addScaledVector(this.vPs, dt);
      const wp = this.wPs;
      _q.set(wp.x * dt * 0.5, wp.y * dt * 0.5, wp.z * dt * 0.5, 0).multiply(q);
      q.x += _q.x; q.y += _q.y; q.z += _q.z; q.w += _q.w; q.normalize();
      this.vPs.set(0, 0, 0); this.wPs.set(0, 0, 0);
    }

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

  // One upright post against the body boxes and the tyres. Samples the post every 4 cm up its height; per
  // box (and per tyre) keeps the deepest overlap as one contact with a horizontal normal.
  _postContacts(t, q, up, R, HW) {
    const mat = t.mat || 'wood';
    const y0 = Math.max(t.y0 ?? -1e9, this.pos.y - 0.7), y1 = Math.min(t.top, this.pos.y + 0.8);
    if (y1 <= y0) return;
    const P = _v3, L = _v4, Lp = _v5;
    let hit = false;
    for (const b of BOXES) {
      const [hx, by0, by1, bz0, bz1, part] = b;
      let best = null;
      for (let y = y0; y <= y1 + 1e-6; y += 0.04) {
        P.set(t.x, y, t.z);
        L.copy(P).sub(this.pos).applyQuaternion(_q);
        if (L.y < by0 || L.y > by1) continue;
        const cx = THREE.MathUtils.clamp(L.x, -hx, hx), cz = THREE.MathUtils.clamp(L.z, bz0, bz1);
        let nx = cx - L.x, nz = cz - L.z, d = Math.hypot(nx, nz), pen, px = cx, pz = cz;
        if (d > 1e-6) {
          if (d >= t.r) continue;
          nx /= d; nz /= d; pen = t.r - d;
        } else {
          // the post's axis is inside this box. Push it back out through the face it came in by (from
          // the previous substep's pose), never through the far side: this is what stops a thin stake
          // tunnelling through the truck at speed.
          Lp.copy(P).sub(this.prevPos).applyQuaternion(this._prevInvQ);
          const faces = [[hx - L.x, -1, 0, Lp.x > hx], [L.x + hx, 1, 0, Lp.x < -hx], [bz1 - L.z, 0, -1, Lp.z > bz1], [L.z - bz0, 0, 1, Lp.z < bz0]];
          let f = faces.filter((fc) => fc[3]).sort((a, c) => a[0] - c[0])[0];
          if (!f) f = faces.sort((a, c) => a[0] - c[0])[0];
          nx = f[1]; nz = f[2]; pen = t.r + f[0];
          px = L.x - nx * f[0]; pz = L.z - nz * f[0];
        }
        if (!best || pen > best.pen) best = { pen, nx, nz, px, py: L.y, pz };
      }
      if (best) {
        const n = new THREE.Vector3(best.nx, 0, best.nz).applyQuaternion(q); n.y = 0;
        if (n.lengthSq() < 1e-6) continue;
        const cp = new THREE.Vector3(best.px, best.py, best.pz).applyQuaternion(q).add(this.pos);
        this.contacts.push({ p: cp, n: n.normalize(), e: best.pen, mu: 0.35, part, mat, post: t, ov: t.v });
        hit = true;
      }
    }
    // tyres: a cylinder of radius R and half-width HW around each hub's axle
    for (const w of this.wheels) {
      if (!w.dirF) continue;
      const hub = _r.copy(w.hub).addScaledVector(up, Math.max(0, w.c));
      let best = null;
      for (let y = Math.max(y0, hub.y - R - t.r); y <= Math.min(y1, hub.y + R + t.r) + 1e-6; y += 0.04) {
        const dx = t.x - hub.x, dy = y - hub.y, dz = t.z - hub.z;
        const a = dx * w.dirA.x + dy * w.dirA.y + dz * w.dirA.z;
        if (Math.abs(a) >= HW + t.r) continue;
        const f = dx * w.dirF.x + dy * w.dirF.y + dz * w.dirF.z;
        const u = dx * up.x + dy * up.y + dz * up.z;
        const rad = Math.hypot(f, u);
        if (rad >= R + t.r) continue;
        const penR = R + t.r - rad, penA = HW + t.r - Math.abs(a);
        let n;
        if (penR <= penA) n = new THREE.Vector3().addScaledVector(w.dirF, -f).addScaledVector(up, -u);   // tread
        else n = w.dirA.clone().multiplyScalar(-Math.sign(a));                                          // sidewall
        n.y = 0;
        if (n.lengthSq() < 1e-8) continue;
        const pen = Math.min(penR, penA);
        if (!best || pen > best.pen) best = { pen, n: n.normalize(), p: new THREE.Vector3(t.x, y, t.z) };
      }
      if (best) { this.contacts.push({ p: best.p, n: best.n, e: best.pen, mu: 0.3, part: 'tyre', mat, post: t, ov: t.v }); hit = true; }
    }
    if (hit) this.touched.add(t);
  }

  // Sequential-impulse contact solver. Normal impulses cancel closing speed (with a little restitution
  // on hard hits only), Coulomb friction is bounded by the normal impulse, and penetration is removed
  // through separate pseudo velocities (split impulse) so pushing out of an overlap never becomes
  // rebound speed.
  _solveContacts(dt) {
    const C = this.contacts;
    if (!C.length) return;
    for (const c of C) {
      c.mn = this._effMass(c.p, c.n);
      c.vn0 = this._relVel(c, _v3).dot(c.n);
      c.target = c.vn0 < -PHYS.restMinV ? -PHYS.restitution * c.vn0 : 0;
      c.jn = 0; c.jt = 0; c.jp = 0;
    }
    const tdir = _tdir;
    for (let it = 0; it < 8; it++) {
      for (const c of C) {
        const vn = this._relVel(c, _v3).dot(c.n);
        let dj = (c.target - vn) * c.mn;
        const old = c.jn; c.jn = Math.max(0, old + dj); dj = c.jn - old;
        if (dj !== 0) this._applyImpulse(_v4.copy(c.n).multiplyScalar(dj), c.p);
        if (c.mu > 0 && c.jn > 0) {
          const vp = this._relVel(c, _v3);
          tdir.copy(vp).addScaledVector(c.n, -vp.dot(c.n));
          const vt = tdir.length();
          if (vt > 1e-5) {
            tdir.multiplyScalar(1 / vt);
            const budget = c.mu * c.jn - c.jt;
            const jt = Math.min(vt * this._effMass(c.p, tdir), Math.max(0, budget));
            if (jt > 0) { c.jt += jt; this._applyImpulse(_v4.copy(tdir).multiplyScalar(-jt), c.p); }
          }
        }
      }
    }
    // penetration recovery on pseudo velocities
    for (let it = 0; it < 6; it++) {
      for (const c of C) {
        if (c.e <= PHYS.slop) continue;
        _r.copy(c.p).sub(this.pos);
        const vpn = _v3.copy(_r).cross(this.wPs).negate().add(this.vPs).dot(c.n);
        let dj = (PHYS.beta * (c.e - PHYS.slop) / dt - vpn) * c.mn;
        const old = c.jp; c.jp = Math.max(0, old + dj); dj = c.jp - old;
        if (dj !== 0) {
          _v4.copy(c.n).multiplyScalar(dj);
          this.vPs.addScaledVector(_v4, 1 / PHYS.mass);
          this._applyInvI(_r.cross(_v4), _v3);
          this.wPs.add(_v3);
        }
      }
    }
    // feedback: bump-stop load for tyre grip, impact events for audio/particles, scrape level
    for (const c of C) {
      if (c.wheel) c.wheel.bumpF = c.jn / dt;
      if (c.post && c.post.breakable && !c.post.broken) {
        c.post.stress = (c.post.stress || 0) + c.jn;
        c.post.pushN = (c.post.pushN || new THREE.Vector3()).copy(c.n);   // n pushes the truck; the stake goes -n
        c.post.hitV = Math.max(c.post.hitV || 0, -c.vn0);
      }
      // every contact that closed at speed is a collision the player should hear, at that point
      if (c.vn0 < -0.25 && this.events.length < 64) this.events.push({ type: 'hit', mat: c.mat || 'dirt', part: c.part || 'body', speed: -c.vn0, impulse: c.jn, p: c.p.clone() });
      if (c.scrape) {
        const vp = this._pointVel(c.p, _v3);
        const vt = vp.addScaledVector(c.n, -vp.dot(c.n)).length();
        if (vt > 0.15 && Math.min(1, vt * 0.4) > this.stats.scrape) { this.stats.scrape = Math.min(1, vt * 0.4); this.stats.scrapeMat = c.mat || 'dirt'; }
      }
    }
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
