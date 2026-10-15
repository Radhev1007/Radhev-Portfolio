// Activity kit: optional obstacle sections and stunt areas added beside the existing trail of every terrain.
//
// Nothing here edits a level's own layout. buildActivities() runs after a level's build(): it scores
// candidate pads beside the trail (clear of the trail, water, rocks, logs, markers and the spawn), levels
// each chosen pad into the terrain, joins it to the trail with two short spurs, then builds one obstacle
// on it. Every activity is a timed challenge with a tier (Beginner / Intermediate / Expert), a par time for
// medals and a sign at its entrance.
//
// Collision: terrain shaping edits the heightfield; rocks and logs use the existing rock/log pipelines;
// planks, beams and tyres are real geometry rasterised into the physics heightfield exactly like rocks
// (so wheels and body probes meet their actual top surfaces). The seesaw is a dynamic surface the
// heightfield query includes, tilted by the truck's real wheel loads (see SeesawPlatform).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURF } from '../terrain/heightfield.js';
import { smoothstep, clamp, lerp } from '../core/noise.js';

const TIERS = ['Beginner', 'Intermediate', 'Expert'];
const SIGN = ['easy', 'medium', 'hard'];
const pick3 = (tier, a) => a[Math.min(2, Math.max(0, tier))];

// ------------------------------------------------------------------ per-terrain programmes
// Each terrain gets the six signature categories adapted to its style, plus activities that suit it.
// [kind, tier, style] in priority order: if a terrain runs out of room, the tail is dropped.
const PROGRAMME = {
  canyon: [['rockCrawl', 2], ['slopes', 2], ['jump', 1], ['bridge', 1, 'timber'], ['logPile', 0, 'beams'], ['mudRuts', 0, 'clay'],
    ['rockStairs', 2], ['precision', 2], ['flex', 1], ['ridge', 2]],
  forest: [['logPile', 2], ['bridge', 1, 'timber'], ['mudRuts', 1], ['rockCrawl', 0, 'mossy'], ['slopes', 1], ['jump', 0],
    ['seesaw', 1], ['slalom', 1], ['recovery', 1]],
  mud: [['mudRuts', 2], ['logPile', 1], ['bridge', 0, 'logs'], ['slopes', 1, 'greasy'], ['jump', 1], ['rockCrawl', 0],
    ['tires', 1], ['flex', 0], ['channel', 0], ['slalom', 0]],
  desert: [['jump', 2], ['slopes', 2], ['rockCrawl', 1], ['bridge', 0, 'weathered'], ['logPile', 0, 'beams'], ['mudRuts', 0, 'wash'],
    ['dunes', 1], ['tires', 0], ['maze', 1], ['ridge', 1], ['slalom', 2], ['multi', 1]],
  creek: [['bridge', 2, 'logs'], ['jump', 0], ['rockCrawl', 1], ['channel', 1], ['logPile', 1], ['mudRuts', 1], ['slopes', 0],
    ['maze', 0], ['seesaw', 0], ['precision', 1]],
  ultimate: [['jump', 2], ['mudRuts', 2], ['slopes', 2], ['logPile', 2], ['rockCrawl', 2], ['bridge', 2], ['multi', 2],
    ['recovery', 2], ['slalom', 2], ['rockStairs', 1], ['ridge', 1]],
};

// pad footprints [length, width] in metres (the truck is 0.86 m wide, 1.76 m long)
const NATURAL = new Set(['mudRuts', 'rockCrawl', 'slopes', 'maze', 'precision']);
const PAD = {
  rockCrawl: [10, 4], bridge: [9, 3.4], mudRuts: [10, 4], slopes: [11, 4.4], logPile: [9, 3.8], jump: [15, 3.6],
  tires: [9, 4], rockStairs: [9, 3.6], ridge: [11, 3.6], maze: [10, 5], channel: [8, 4], dunes: [12, 4.4],
  seesaw: [9, 3.2], flex: [9, 3.4], slalom: [12, 4], precision: [10, 3.6], recovery: [8, 5], multi: [17, 4.4],
};

const LAYER = { rock: 0, dirt: 1, grass: 2, sand: 3, mud: 4, forest: 5, gravel: 6 };

// ------------------------------------------------------------------ props: meshes + collision geometry
function woodTexture(base, dark) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${dark},${0.12 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2;
    const x = Math.random() * 64; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 32) g.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Props {
  constructor() {
    this.parts = new Map();   // material key -> geometries
    this.phys = [];           // { pos, index, surf }
  }
  add(matKey, geo, surf = null) {
    if (!this.parts.has(matKey)) this.parts.set(matKey, []);
    this.parts.get(matKey).push(geo);
    if (surf !== null) this.phys.push({ geo, surf });
  }
  build() {
    const g = new THREE.Group(); g.name = 'activities';
    const mats = {
      plank: new THREE.MeshStandardMaterial({ map: woodTexture('#8a6a48', '60,40,20'), roughness: 0.85 }),
      weathered: new THREE.MeshStandardMaterial({ map: woodTexture('#8f8578', '70,62,52'), roughness: 0.92 }),
      beam: new THREE.MeshStandardMaterial({ map: woodTexture('#5e4630', '35,22,10'), roughness: 0.9 }),
      tyre: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.55, metalness: 0.6 }),
      paint: new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.7 }),
    };
    for (const [k, list] of this.parts) {
      const geos = list.map((x) => (x.index ? x.toNonIndexed() : x));
      for (const x of geos) { if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); }
      const merged = mergeGeometries(geos.map((x) => { const y = x.clone(); for (const n of Object.keys(y.attributes)) if (!['position', 'normal', 'uv'].includes(n)) y.deleteAttribute(n); return y; }), false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mats[k] || mats.plank);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
}

// ------------------------------------------------------------------ seesaw: a dynamic surface
// A plank on a pivot. Its top is part of heightAt() (Heightfield.dyn), so wheels and probes drive on it
// like terrain. Each physics substep the vehicle reports wheel loads on it; the plank integrates
// I·θ'' = −Σ F·u − c·θ' and stops dead (inelastic) at its end stops, where an end touches the ground.
export class SeesawPlatform {
  constructor(px, py, pz, yaw, halfLen, halfWid, thick, maxA) {
    Object.assign(this, { px, py, pz, yaw, L: halfLen, W: halfWid, thick, maxA });
    this.a = maxA;               // start with the entry end (−u) on the ground
    this.w = 0;
    this.I = 0.5 * (2 * halfLen) ** 2 / 12;
    this.c = 0.6;
    this.torque = 0;
    this.fu = Math.sin(yaw); this.fz = Math.cos(yaw);
    this.events = [];
  }
  _local(x, z) { const dx = x - this.px, dz = z - this.pz; return [dx * this.fu + dz * this.fz, dx * this.fz - dz * this.fu]; }
  heightAt(x, z) {
    const [u, v] = this._local(x, z);
    if (Math.abs(u) > this.L || Math.abs(v) > this.W) return -Infinity;
    return this.py + this.thick + u * Math.tan(this.a);
  }
  load(x, z, F) { const [u] = this._local(x, z); this.torque += -F * u * Math.cos(this.a); }
  step(dt) {
    this.w += (this.torque - this.c * this.w) / this.I * dt;
    this.torque = 0;
    this.a += this.w * dt;
    if (Math.abs(this.a) >= this.maxA) {
      if (Math.abs(this.w) > 0.4) this.events.push({ type: 'hit', mat: 'wood', part: 'bump', speed: Math.abs(this.w) * this.L, impulse: Math.abs(this.w) * 0.3, p: new THREE.Vector3(this.px + this.fu * this.L * Math.sign(-this.a), this.py, this.pz + this.fz * this.L * Math.sign(-this.a)) });
      this.a = Math.sign(this.a) * this.maxA; this.w = 0;
    }
  }
}

// ------------------------------------------------------------------ the builder
export function buildActivities(ctx, def, layout, TrailPath) {
  const plan = PROGRAMME[def.id];
  if (!plan || !layout?.path) return { challenges: [], placed: [] };
  const path = layout.path, hf = ctx.hf, rng = ctx.rng;
  // The driving surface of the original trail (and anything carved before us) is protected: no pad,
  // shaping or spur may change those vertices, so every existing route drives exactly as it did. Only
  // the trail's outer banks (trailW < 1) may be eased where a spur joins, so spurs meet the bed flush.
  const protect = Float32Array.from(ctx.trailW);
  const isProtected = (k) => protect[k] > 0.97;
  ctx.protect = isProtected;
  const D = ctx.distanceField(path, 22);
  const props = (ctx.props = ctx.props || new Props());
  ctx.dynamics = ctx.dynamics || [];
  const sites = [], challenges = [], placed = [], skipped = [], spurs = [], gully = new Set();
  for (const r of ctx.rocks.instances) r._y0 = hf.baseHeightAt(r.x, r.z);     // to re-seat rocks after earthworks
  const spawn = path.at(0);
  const water = ctx.water || [];
  const inWater = (x, z) => water.some((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && hf.baseHeightAt(x, z) < w.y + 0.25);

  // ---- site search. Candidates on a grid over the whole playable area, 4.6-22 m from the trail, each
  // tried parallel and perpendicular to the nearest stretch of trail. A pad is rejected if it would touch
  // the trail, water, the spawn, a marker, a log or any existing rock (pads are levelled, and a rock on a
  // levelled pad would float or sink), or need more than 2.5 m of earthworks. Lowest score wins: least
  // earthworks, then closest to the trail.
  const nearest = (x, z) => {
    let bi = 0, bd = 1e9;
    for (let i = 0; i <= path.N; i += 2) { const P = path.pts[i]; const d = (P.x - x) ** 2 + (P.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  };
  const why = {};
  const rej = (r) => { why[r] = (why[r] || 0) + 1; };
  const cut = !!def.activityCut;
  const LEAD = cut ? 4.5 : 2.4;          // straight lead-in onto the pad axis (longer in gorge cuts: gentler turn)
  function findSite(len, wid, opts = {}) {
    buildOcc();
    const cands = [];
    const lim = 46;
    for (let gx = -lim; gx <= lim; gx += 1.5) {
      for (let gz = -lim; gz <= lim; gz += 1.5) {
        const dTrail = D(gx, gz);
        if (dTrail < 4.6 + wid / 2 || dTrail > 22) continue;
        if (Math.hypot(gx - spawn.x, gz - spawn.z) < 10) continue;
        const R = Math.hypot(len, wid) / 2 + 2;
        if (sites.some((s) => Math.hypot(s.cx - gx, s.cz - gz) < R + s.R + 1.5)) continue;
        const ni = nearest(gx, gz), t = ni / path.N;
        const T = path.tan[ni], Nn = path.normal(t);
        const side = Math.sign((gx - path.pts[ni].x) * Nn.x + (gz - path.pts[ni].z) * Nn.z) || 1;
        // gorge maps: pads are alcoves along the foot of the wall, parallel to the trail
        const yaws = cut ? [path.yaw(t)] : [path.yaw(t), path.yaw(t) + Math.PI / 2];
        for (const yaw of yaws) {
          const fu = Math.sin(yaw), fz = Math.cos(yaw);
          const half = Math.abs(fu) * len / 2 + Math.abs(fz) * wid / 2, halfZ = Math.abs(fz) * len / 2 + Math.abs(fu) * wid / 2;
          if (Math.abs(gx) + half > lim || Math.abs(gz) + halfZ > lim) continue;
          let ok = true, hmin = 1e9, hmax = -1e9;
          for (let u = -len / 2 - 1; u <= len / 2 + 1 && ok; u += 1) {
            for (let v = -wid / 2 - 1; v <= wid / 2 + 1; v += 1) {
              const x = gx + fu * u + fz * v, z = gz + fz * u - fu * v;
              if (D(x, z) < 3.2 || (!opts.water && inWater(x, z))) { ok = false; break; }
              const h = hf.baseHeightAt(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
            }
          }
          if (!ok) { rej('trail/water'); continue; }
          // gorge maps (canyon) cut the pad into the foot of the wall as a side alcove, levelled to the floor
          const floorY = cut ? hf.baseHeightAt(path.pts[ni].x, path.pts[ni].z) + 0.15 : null;
          if (hmax - hmin > (cut ? 9 : 3.5)) { rej('range'); continue; }
          // the approach spurs must stay drivable: at most 3.5 m above or below the trail, at a grade under ~24°
          const P = path.pts[ni];
          if (Math.abs((cut ? floorY : (hmin + hmax) / 2) - hf.baseHeightAt(P.x, P.z)) > Math.min(3.5, 0.45 * (dTrail + 6))) { rej('grade'); continue; }
          const inPad = (x, z, m) => { const dx = x - gx, dz = z - gz, u = dx * fu + dz * fz, v = dx * fz - dz * fu; return Math.abs(u) < len / 2 + m && Math.abs(v) < wid / 2 + m; };
          // the pad plus its 1.2 m blend zone must be clear of every rock's footprint
          // no rock may reach onto the pad itself; rocks in the blend zone are re-seated on the new ground
          let rocky = false;
          for (let u = -len / 2; u <= len / 2 + 1e-6 && !rocky; u += 0.5) for (let v = -wid / 2; v <= wid / 2 + 1e-6; v += 0.5) {
            if (occ[bIdx(gx + fu * u + fz * v, gz + fz * u - fu * v)] > (opts.natural ? 1 : 0)) { rocky = true; break; }
          }
          if (rocky) { rej('rock'); continue; }
          if (ctx.markers.some((m) => inPad(m.x, m.z, 1.5))) continue;
          if (ctx.logBoxes.some((b) => inPad((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 1.5 + Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2))) continue;
          const score = (cut ? 0 : (hmax - hmin) * 1.3) + dTrail * 0.12;
          cands.push({ t, side, lat: dTrail, cx: gx, cz: gz, yaw, len, wid, R, score, floorY });
        }
      }
    }
    // best-scoring candidate whose two approach spurs are both drivable and rock-free
    cands.sort((a, b) => a.score - b.score);
    buildBlocked();
    for (const c of cands.slice(0, 150)) {
      const y = c.floorY ?? padHeight(c);
      const ends = [-1, 1].map((dt) => planSpur(c, y, dt));
      if (ends.every(Boolean)) { c.spurStarts = ends; return c; }
      rej('spur');
    }
    return null;
  }
  // boulders a spur may not run through (small rocks are fine: the truck crawls over them), on a 0.5 m grid
  const BG = 0.5, BN = Math.ceil(140 / BG), blocked = new Int32Array(BN * BN);
  const bIdx = (x, z) => { const i = Math.floor((x + 70) / BG), j = Math.floor((z + 70) / BG); return i < 0 || j < 0 || i >= BN || j >= BN ? -1 : j * BN + i; };
  function buildBlocked() {
    blocked.fill(0);
    for (const [ri, r] of ctx.rocks.instances.entries()) {
      if (r.radius <= 0.25 || !r.physics) continue;   // rocks under ~0.25 m stay: the truck crawls over them
      const rr = 0.9 + footprint(r);
      for (let x = r.x - rr; x <= r.x + rr; x += BG) for (let z = r.z - rr; z <= r.z + rr; z += BG) {
        if ((x - r.x) ** 2 + (z - r.z) ** 2 > rr * rr) continue;
        const k = bIdx(x, z); if (k >= 0) blocked[k] = ri + 1;
      }
    }
  }
  // true horizontal reach of a rock's collision mesh from its centre (cliff meshes reach well past
  // their nominal radius), cached on the instance
  function footprint(r) {
    if (r._fr !== undefined) return r._fr;
    const src = ctx.rocks.protos[r.pi].geoLo.attributes.position.array, e = r.m.elements;
    let fr = 0;
    for (let i = 0; i < src.length; i += 3) {
      const x = e[0] * src[i] + e[4] * src[i + 1] + e[8] * src[i + 2] + e[12], z = e[2] * src[i] + e[6] * src[i + 1] + e[10] * src[i + 2] + e[14];
      fr = Math.max(fr, Math.hypot(x - r.x, z - r.z));
    }
    return (r._fr = fr);
  }
  // every rock's reach (+0.3 m) on the same grid, for the pad clearance test
  const occ = new Uint8Array(BN * BN), spurOcc = new Uint8Array(BN * BN);
  function buildOcc() {
    occ.fill(0);
    for (const r of ctx.rocks.instances) {
      if (r.radius <= 0.12) continue;
      const rr = footprint(r) + 0.3 + BG * 0.71, big = footprint(r) > 0.9;   // natural-ground pads may keep small rocks
      for (let x = r.x - rr; x <= r.x + rr; x += BG) for (let z = r.z - rr; z <= r.z + rr; z += BG) {
        if ((x - r.x) ** 2 + (z - r.z) ** 2 > rr * rr) continue;
        const k = bIdx(x, z); if (k >= 0) occ[k] = Math.max(occ[k], big ? 2 : 1);
      }
    }
  }
  const blockerAt = (x, z) => { const k = bIdx(x, z); return k >= 0 ? blocked[k] - 1 : -1; };
  function padHeight(c) {
    const fu = Math.sin(c.yaw), fz = Math.cos(c.yaw), hs = [];
    for (let u = -c.len / 2; u <= c.len / 2; u += 0.5) for (let v = -c.wid / 2; v <= c.wid / 2; v += 0.5) hs.push(hf.baseHeightAt(c.cx + fu * u + fz * v, c.cz + fz * u - fu * v));
    hs.sort((a, b) => a - b);
    return hs[Math.floor(hs.length / 2)];
  }
  // a spur from the trail to one end of the pad. The join point is chosen along the trail (up to 12 m
  // either side of the nearest point) for the gentlest grade; the corridor (plus its blend) must be clear
  // of every rock and must not run back across the trail. Returns the trail-side start, or null.
  function planSpur(c, y, dt) {
    const fu = Math.sin(c.yaw), fz = Math.cos(c.yaw), k = dt * (c.len / 2 + LEAD);
    const m = { x: c.cx + fu * k, z: c.cz + fz * k };
    const n0 = nearest(m.x, m.z), step = path.len / path.N;
    const inSite = (x, z) => sites.some((o) => { const dx = x - o.cx, dz = z - o.cz, u = dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw), v = dx * Math.cos(o.yaw) - dz * Math.sin(o.yaw); return Math.abs(u) < o.len / 2 + 1.5 && Math.abs(v) < o.wid / 2 + 1.5; });
    let best = null;
    for (const off of [0, -3, 3, -6, 6, -9, 9, -12, 12]) {
      const ni = clamp(n0 + Math.round(off / step), 0, path.N), t = ni / path.N, P = path.pts[ni];
      const Nn = path.normal(t), sd = Math.sign((m.x - P.x) * Nn.x + (m.z - P.z) * Nn.z) || 1;
      const a = path.offset(t, sd * 0.3);      // from the bed: the spur grades out of the trail from its edge
      // straight, or a dog-leg through a waypoint beside the midpoint to get round a boulder
      const mx = (a.x + m.x) / 2, mz = (a.z + m.z) / 2, sl = Math.hypot(m.x - a.x, m.z - a.z) || 1;
      const px = -(m.z - a.z) / sl, pz = (m.x - a.x) / sl;
      for (const dog of cut ? [0] : [0, -2.5, 2.5, -5, 5]) {
        const pts = dog ? [a, { x: mx + px * dog, z: mz + pz * dog }, m] : [a, m];
        let run = 1.6;
        for (let i = 1; i < pts.length; i++) run += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        const grade = Math.abs(y - hf.baseHeightAt(a.x, a.z)) / run;
        if (grade > 0.45) continue;
        let ok = true, done = 0;
        const gap = new Set();
        for (let i = 1; i < pts.length && ok; i++) {
          const p0 = pts[i - 1], p1 = pts[i], segL = Math.hypot(p1.x - p0.x, p1.z - p0.z);
          const px0 = -(p1.z - p0.z) / (segL || 1), pz0 = (p1.x - p0.x) / (segL || 1);
          for (let f = 0; f <= 1.0001 && ok; f += 0.5 / Math.max(1, segL)) {
            const x = p0.x + (p1.x - p0.x) * f, z = p0.z + (p1.z - p0.z) * f;
            const along = done + f * segL;
            if (along > 3 && D(x, z) < 1.7) ok = false;                                  // runs back across the trail
            else if (inWater(x, z) || inSite(x, z)) ok = false;                          // water or another pad
            else if (along > 3 && spurOcc[bIdx(x, z)]) ok = false;                       // across another spur
            else for (const off of cut ? [0, -1.6, 1.6] : [0]) {
              const ri = blockerAt(x + px0 * off, z + pz0 * off);
              if (ri < 0) continue;
              // gorge maps: a side-canyon spur may clear the shoulder boulders and wall-dressing rocks in its
              // way (never a rock within 3.6 m of the trail centreline, so no trail obstacle is touched);
              // elsewhere boulders block
              const r = ctx.rocks.instances[ri];
              if (cut && D(r.x, r.z) > 3.6) gap.add(ri); else ok = false;
            }
          }
          done += segL;
        }
        if (!ok || gap.size > 5) continue;
        // the turn from the last leg onto the pad axis: prefer gentle ones over hairpins
        const last = pts[pts.length - 2], ll = Math.hypot(m.x - last.x, m.z - last.z) || 1;
        const turn = ((m.x - last.x) * -dt * fu + (m.z - last.z) * -dt * fz) / ll;      // cos of the turn angle
        const cost = grade * 10 + run * 0.04 + gap.size * 2 + (dog ? 0.5 : 0) + (1 - turn) * 3;
        if (!best || cost < best.cost) best = { a, via: pts.slice(1, -1), cost, gap };
      }
    }
    return best;
  }


  // log bounding boxes so pads never land on an existing log
  ctx.logBoxes = ctx.logsPhys.map((g) => { g.computeBoundingBox(); const b = g.boundingBox; return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z }; });

  for (const [kind, tier, style] of plan) {
    const [len, wid] = PAD[kind];
    const natural = NATURAL.has(kind);
    let s = findSite(len, wid, { water: kind === 'channel' });
    // tight maps: retry with a more compact pad (the jump keeps the 9.3 m its ramps need plus a short run-up);
    // natural-ground sections may then keep small existing rocks as part of the obstacle
    if (!s && kind !== 'channel') s = findSite(kind === 'jump' ? 12 : Math.round(len * 0.85 * 2) / 2, wid * 0.92, {});
    if (!s && kind === 'jump') s = findSite(11, wid * 0.92, {});
    if (!s && natural) s = findSite(Math.round(len * 0.85 * 2) / 2, wid * 0.92, { natural });
    if (!s) { skipped.push(kind); continue; }
    s.kind = kind; s.tier = tier; s.style = style; s.id = `act-${kind}`;
    sites.push(s);
    const site = makeSite(s);
    levelPad(site);
    connect(site);
    if (gully.size) { const keep = ctx.rocks.instances.filter((r) => !gully.has(r)); ctx.rocks.instances.length = 0; ctx.rocks.instances.push(...keep); }
    const c = BUILD[kind](site, tier, style);
    if (c) {
      const fu = site.fu, fz = site.fz;
      const g0 = { x: site.cx - fu * (len / 2 - 0.5), z: site.cz - fz * (len / 2 - 0.5), yaw: site.yaw, width: wid + 0.4 };
      const g1 = { x: site.cx + fu * (len / 2 - 0.5), z: site.cz + fz * (len / 2 - 0.5), yaw: site.yaw, width: wid + 0.4 };
      const gates = c.gates || [g0, g1];
      gates.forEach((g, i) => ctx.markers.push({ type: i === 0 ? 'start' : i === gates.length - 1 ? 'finish' : 'gate', ...g, id: s.id }));
      // tier sign at the entrance (green / blue / black, like the existing lane signs)
      const sg = site.at(-len / 2 - 0.4, wid / 2 + 0.5);
      ctx.markers.push({ type: 'lane', diff: SIGN[tier], x: sg.x, z: sg.z, yaw: site.yaw });
      challenges.push({ id: s.id, name: c.name, desc: c.desc, tier: TIERS[tier], par: c.par, rules: { noRollover: true, ...(c.rules || {}) }, gates, activity: kind });
      placed.push(kind);
    }
  }
  // Park Run: where the dedicated multi-stage pad didn't fit, chain this terrain's activity sections into
  // one continuous timed run, in trail order, through each section's entry and exit.
  if (plan.some(([k]) => k === 'multi') && !placed.includes('multi') && sites.length >= 3) {
    const chain = [...sites].sort((a, b) => a.t - b.t).slice(0, 4);
    const gates = [];
    let par = 0, prev = null;
    for (const st of chain) {
      const site = makeSite(st), c = challenges.find((x) => x.id === st.id);
      const a = site.at(-st.len / 2 + 0.5), b = site.at(st.len / 2 - 0.5);
      gates.push({ x: a.x, z: a.z, yaw: st.yaw, width: st.wid + 0.4 }, { x: b.x, z: b.z, yaw: st.yaw, width: st.wid + 0.4 });
      par += c ? c.par : 15;
      if (prev) par += Math.hypot(a.x - prev.x, a.z - prev.z) / 1.6;
      prev = b;
    }
    gates.forEach((g, i) => { g.hidden = i > 0 && i < gates.length - 1; ctx.markers.push({ type: i === 0 ? 'start' : i === gates.length - 1 ? 'finish' : 'gate', ...g, id: 'act-park' }); });
    challenges.push({ id: 'act-park', name: 'Park Run', desc: `Multi-stage: ${chain.map((x) => (challenges.find((c) => c.id === x.id) || {}).name).join(' → ')}, in one clean run.`,
      tier: TIERS[2], par: Math.round(par), rules: { noRollover: true }, gates, activity: 'multi' });
    placed.push('park');
  }
  // re-seat pre-existing rocks whose ground was re-shaped (pad blends, spurs) so none float or sink
  for (const r of ctx.rocks.instances) {
    if (r._y0 === undefined) continue;
    const dy = hf.baseHeightAt(r.x, r.z) - r._y0;
    // small blend-zone changes only: a wall rock straddling a deep gully cut stays on the remaining wall
    if (Math.abs(dy) > 0.01 && Math.abs(dy) < 0.6) { r.m.elements[13] += dy; r.top += dy; }
    delete r._y0;
  }
  return { challenges, placed, skipped, sites, spurs, why, gullyRocks: gully.size };

  // ---------------------------------------------------------------- site helpers
  function makeSite(s) {
    const fu = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const site = {
      ...s, fu, fz, ctx, hf, rng, props,
      // pad-local (u along the pad, v across it, left positive) to world
      at(u, v = 0) { return { x: s.cx + fu * u + fz * v, z: s.cz + fz * u - fu * v }; },
      local(x, z) { const dx = x - s.cx, dz = z - s.cz; return [dx * fu + dz * fz, dx * fz - dz * fu]; },
      y: 0,
    };
    return site;
  }

  function levelPad(site) {
    const { len, wid } = site, m = 1.2;
    const hs = [];
    for (let u = -len / 2; u <= len / 2; u += 0.5) for (let v = -wid / 2; v <= wid / 2; v += 0.5) { const p = site.at(u, v); hs.push(hf.baseHeightAt(p.x, p.z)); }
    hs.sort((a, b) => a - b);
    site.y = site.floorY ?? hs[Math.floor(hs.length / 2)];
    const R = Math.hypot(len / 2 + m, wid / 2 + m);
    ctx.forEachNear(site.cx, site.cz, R, (k, x, z) => {
      if (isProtected(k)) return;
      const [u, v] = site.local(x, z);
      const du = Math.max(0, Math.abs(u) - len / 2), dv = Math.max(0, Math.abs(v) - wid / 2);
      const d = Math.hypot(du, dv);
      if (d > m) return;
      const w = 1 - smoothstep(0, m, d);
      hf.base[k] = lerp(hf.base[k], site.y, w);
      if (d < 0.4) { ctx.trailW[k] = Math.max(ctx.trailW[k], 0.55 * (1 - d / 0.4)); }
    });
    for (let u = -len / 2; u <= len / 2; u += 2) for (const v of [-wid / 2, 0, wid / 2]) { const p = site.at(u, v); ctx.noVeg.push({ x: p.x, z: p.z, r: 2.2 }); }
  }

  function connect(site) {
    const { len } = site;
    [-1, 1].forEach((dt, i) => {
      if (site.spurStarts[i].none) return;
      const e = site.at(dt * (len / 2 + 0.8), 0), m = site.at(dt * (len / 2 + LEAD), 0), { a, gap } = site.spurStarts[i];
      for (const ri of gap) gully.add(ctx.rocks.instances[ri]);
      const { via } = site.spurStarts[i];
      const sp = new TrailPath([[a.x, a.z], ...via.map((q) => [q.x, q.z]), [m.x, m.z], [e.x, e.z]], 0.4);
      carveSpur(sp, site.y, site);
      spurs.push({ kind: site.kind, pts: sp.pts });
    });
  }



  // Like carvePath, but never touches protected (trail) ground, and its height profile is pinned to the
  // ground where it leaves the trail and to the pad height where it arrives.
  function carveSpur(sp, padY, site) {
    const width = cut ? 2.2 : 0.95, fall = cut ? 1.8 : 1.4, N = sp.N;     // gorge gullies are trail-wide: cut walls either side
    const raw = sp.pts.map((P) => hf.baseHeightAt(P.x, P.z));
    const win = Math.max(1, Math.round(1.6 / (sp.len / N)));
    const sm = raw.map((_, i) => { let a = 0, c = 0; for (let k = -win; k <= win; k++) { const q = clamp(i + k, 0, N); a += raw[q]; c++; } return a / c; });
    // the first point that is clear of the trail sets the start height
    let i0 = 0;
    while (i0 < N && isProtected(vIdx(sp.pts[i0].x, sp.pts[i0].z))) i0++;
    const h0 = raw[i0];
    let prof = sm.map((h, i) => { const f = i <= i0 ? 0 : (i - i0) / Math.max(1, N - i0); return h + (1 - f) * (h0 - sm[i0]) + f * (padY - sm[N]); });
    // where the natural ground is steeper than a drivable grade (canyon terraces), use an even ramp instead
    const ds = sp.len / N;
    let steep = 0; for (let i = i0 + 1; i <= N; i++) steep = Math.max(steep, Math.abs(prof[i] - prof[i - 1]) / ds);
    if (cut || steep > 0.4) prof = prof.map((h, i) => i <= i0 ? h0 : lerp(h0, padY, (i - i0) / Math.max(1, N - i0)));
    const tgt = new Map(), wt = new Map();
    for (let i = 0; i <= N; i++) {
      const P = sp.pts[i];
      ctx.forEachNear(P.x, P.z, width + fall, (k, x, z, d) => {
        if (isProtected(k)) return;
        if (site) { const [u, v] = site.local(x, z); if (Math.abs(u) < site.len / 2 && Math.abs(v) < site.wid / 2) return; }   // the pad is the builder's
        const w = 1 - smoothstep(width, width + fall, d);
        if (w > (wt.get(k) || 0)) { wt.set(k, w); tgt.set(k, prof[i]); }
      });
    }
    for (const [k, w] of wt) {
      hf.base[k] = lerp(hf.base[k], tgt.get(k), smoothstep(0, 1, w));
      if (w > ctx.trailW[k]) ctx.trailW[k] = w * 0.8;
      if (w > 0.7) protect[k] = 1;                     // later pads and spurs keep this spur drivable
    }
    for (let i = 0; i <= N; i++) {
      const P = sp.pts[i], r = width + 0.6;
      for (let x = P.x - r; x <= P.x + r; x += BG) for (let z = P.z - r; z <= P.z + r; z += BG) { const k = bIdx(x, z); if (k >= 0) spurOcc[k] = 1; }
    }
    for (let i = 0; i <= N; i += 4) ctx.noVeg.push({ x: sp.pts[i].x, z: sp.pts[i].z, r: width + 1.0 });
  }
  function vIdx(x, z) { const i = clamp(Math.round((x + hf.half) / hf.cell), 0, hf.n), j = clamp(Math.round((z + hf.half) / hf.cell), 0, hf.n); return j * hf.v + i; }
}

// ------------------------------------------------------------------ shaping helpers
function shape(site, fn, margin = 0) {
  const { ctx, hf, len, wid } = site;
  const R = Math.hypot(len / 2 + margin, wid / 2 + margin);
  ctx.forEachNear(site.cx, site.cz, R, (k, x, z) => {
    if (ctx.protect && ctx.protect(k)) return;
    const [u, v] = site.local(x, z);
    if (Math.abs(u) > len / 2 + margin || Math.abs(v) > wid / 2 + margin) return;
    const r = fn(u, v, hf.base[k]);
    if (r !== undefined) hf.base[k] = r;
  });
}
function paint(site, layer, fn = () => 1, margin = 0.5, force = false) {
  const { ctx, len, wid } = site;
  ctx.forEachNear(site.cx, site.cz, Math.hypot(len / 2 + margin, wid / 2 + margin), (k, x, z) => {
    const [u, v] = site.local(x, z);
    if (Math.abs(u) > len / 2 + margin || Math.abs(v) > wid / 2 + margin) return;
    const t = clamp(fn(u, v), 0, 1);
    if (t > ctx.paint[k] || (force && t > 0)) { ctx.paint[k] = t; ctx.paintLayer[k] = layer; }
  });
}
function rock(site, u, v, size, kind = 'boulder', o = {}) {
  const p = site.at(u, v);
  return site.ctx.rocks.add(site.rng, kind, p.x, site.hf.baseHeightAt(p.x, p.z) + (o.lift || 0), p.z, size, { sink: 0.3, yaw: site.rng.float(0, 6.28), tilt: o.tilt, sy: o.sy, sx: o.sx, sz: o.sz });
}
function log(site, u, v, length, radius, yawRel = Math.PI / 2) {
  const p = site.at(u, v);
  site.ctx.addLog(p.x, p.z, length, radius, site.yaw + yawRel);
}
// a box in pad space: centre (u, v), bottom at height y0 above the pad, size along u/v, height h
function box(site, matKey, u, v, y0, su, sv, h, surf = SURF.WOOD, yawRel = 0, tiltU = 0) {
  const g = new THREE.BoxGeometry(sv, h, su);
  g.translate(0, h / 2, 0);
  if (tiltU) g.rotateX(-tiltU);
  g.rotateY(site.yaw + yawRel);
  const p = site.at(u, v);
  g.translate(p.x, site.y + y0, p.z);
  site.props.add(matKey, g, surf);
}
// a tyre (torus); upright = standing on its tread, half sunk
function tyre(site, u, v, R = 0.26, tube = 0.085, upright = false, yawRel = 0) {
  const g = new THREE.TorusGeometry(R, tube, 8, 18);
  if (!upright) { g.rotateX(Math.PI / 2); g.translate(0, tube * 0.75, 0); }
  else { g.translate(0, R * 0.55, 0); }
  g.rotateY(site.yaw + yawRel);
  const p = site.at(u, v);
  g.translate(p.x, site.hf.baseHeightAt(p.x, p.z), p.z);
  site.props.add('tyre', g, SURF.ROCK);
}
function stake(site, u, v, id) { const p = site.at(u, v); site.ctx.markers.push({ type: 'stake', x: p.x, z: p.z, id }); }
function pebbles(site, n, spread = 1) {
  for (let i = 0; i < n; i++) rock(site, site.rng.float(-site.len / 2, site.len / 2) * spread, site.rng.float(-site.wid / 2, site.wid / 2) * spread, site.rng.float(0.04, 0.1), 'pebble', { sink: 0.4 });
}

// ------------------------------------------------------------------ obstacle builders
// Each returns { name, desc, par, rules?, gates? } for its challenge.
const BUILD = {
  // 1. articulated rock crawling: stepped slabs and offset boulders in a corridor that narrows with tier
  rockCrawl(site, tier, style) {
    const lane = pick3(tier, [2.6, 2.0, 1.55]), big = pick3(tier, [0.42, 0.6, 0.85]);
    paint(site, style === 'mossy' ? LAYER.forest : LAYER.rock, (u, v) => 0.6 - Math.abs(v) / site.wid);
    // corridor walls
    for (let u = -site.len / 2 + 0.8; u <= site.len / 2 - 0.8; u += 1.1) for (const sg of [-1, 1]) rock(site, u, sg * (lane / 2 + 0.35 + site.rng.float(0, 0.25)), site.rng.float(0.45, 0.7), 'boulder');
    // crawl line: alternating offset rocks and stepped slabs
    let lift = 0;
    for (let i = 0; i < 6; i++) {
      const u = -site.len / 2 + 1.8 + i * 1.3, v = (i % 2 ? 1 : -1) * lane * 0.18;
      if (i % 3 === 2) { lift = Math.min(lift + pick3(tier, [0.05, 0.08, 0.13]), 0.35); rock(site, u, 0, big * 1.2, 'flat', { sy: 0.32, sink: 0.25, lift, yaw: site.yaw, tilt: 0.04 }); }
      else rock(site, u, v, big * site.rng.float(0.75, 1.05), tier === 2 ? 'block' : 'boulder', { sink: 0.45 });
    }
    return { name: 'Rock Crawl', desc: 'Crawl the stepped slabs and offset boulders without rolling over.', par: pick3(tier, [16, 24, 34]) };
  },

  // 2. wooden balance bridge (planks, log rails or twin balance beams), raised above a shallow ditch
  bridge(site, tier, style) {
    const H = pick3(tier, [0.2, 0.32, 0.42]), deckW = pick3(tier, [1.3, 1.05, 0.95]), Lb = site.len - 3.2;
    const mat = style === 'weathered' ? 'weathered' : 'plank';
    shape(site, (u, v, h) => (Math.abs(v) < 1.3 && Math.abs(u) < Lb / 2 ? h - 0.18 * (1 - Math.abs(v) / 1.3) : h));
    // approach and exit ramps
    for (const sg of [-1, 1]) {
      const r = 1.3, ang = Math.atan2(H, r);
      // the ramp pivots about its own centre, so its centre sits at half the deck height
      box(site, 'beam', sg * (Lb / 2 + r / 2 - 0.05), 0, H / 2 - 0.03, Math.hypot(r, H), deckW, 0.05, SURF.WOOD, 0, sg > 0 ? -ang : ang);
    }
    if (style === 'logs' && tier >= 2) {
      // twin balance logs at track width: each wheel line has its own log
      for (const sg of [-1, 1]) box(site, 'beam', 0, sg * 0.34, H - 0.07, Lb, 0.22, 0.07);
      for (let u = -Lb / 2; u <= Lb / 2; u += 1.2) box(site, 'beam', u, 0, 0, 0.12, 0.95, H - 0.07);
    } else {
      // planks across the deck, slightly uneven and gapped; stringers and posts underneath
      const n = Math.floor(Lb / 0.16);
      for (let i = 0; i < n; i++) {
        const u = -Lb / 2 + 0.08 + i * 0.16, dy = (site.rng.next() - 0.5) * pick3(tier, [0.004, 0.012, 0.02]);
        box(site, style === 'logs' ? 'beam' : mat, u, (site.rng.next() - 0.5) * 0.03, H - 0.04 + dy, 0.145, deckW, 0.04);
      }
      for (const sg of [-1, 1]) box(site, 'beam', 0, sg * (deckW / 2 - 0.08), 0, Lb, 0.08, H - 0.04);
      for (let u = -Lb / 2; u <= Lb / 2 + 0.01; u += 1.0) for (const sg of [-1, 1]) box(site, 'beam', u, sg * (deckW / 2 - 0.05), -0.18, 0.08, 0.08, H + 0.14);
    }
    return {
      name: tier >= 2 && style === 'logs' ? 'Balance Logs' : 'Balance Bridge',
      desc: tier >= 2 && style === 'logs' ? 'Keep both wheel lines on the twin logs to the end.' : 'Cross the narrow plank bridge without dropping off.',
      par: pick3(tier, [12, 16, 22]), rules: { minY: site.y + H * 0.35, zone: { x: site.cx, z: site.cz, r: Lb / 2 } },
    };
  },

  // 3. mud pit with deep ruts: mud surface (low grip, sinkage), twin ruts and uneven depressions
  mudRuts(site, tier, style) {
    const depth = pick3(tier, [0.06, 0.11, 0.17]), dip = pick3(tier, [0.08, 0.16, 0.24]);
    const { ctx } = site;
    const surfLayer = style === 'wash' ? LAYER.sand : style === 'clay' ? LAYER.dirt : LAYER.mud;
    shape(site, (u, v, h) => {
      const along = Math.cos((u / (site.len / 2)) * Math.PI * 0.5);
      const rut = Math.exp(-Math.pow((Math.abs(v) - 0.34) / 0.1, 2)) * depth;
      const hole = dip * Math.max(0, ctx.n.noise(u * 0.45 + site.cx, v * 0.6 + site.cz) + 0.2);
      return h - along * (rut + hole * 0.8 + dip * 0.4);
    });
    ctx.forEachNear(site.cx, site.cz, Math.hypot(site.len / 2, site.wid / 2), (k, x, z) => {
      const [u, v] = site.local(x, z);
      if (Math.abs(u) > site.len / 2 || Math.abs(v) > site.wid / 2) return;
      const w = 1 - smoothstep(site.wid * 0.25, site.wid * 0.5, Math.abs(v));
      if (surfLayer === LAYER.mud) { ctx.mudW[k] = Math.max(ctx.mudW[k], w * 0.95); ctx.wetW[k] = Math.max(ctx.wetW[k], w); }
      else if (w > ctx.paint[k]) { ctx.paint[k] = w; ctx.paintLayer[k] = surfLayer; }
    });
    if (surfLayer === LAYER.mud && tier > 0) ctx.pendingPuddles = (ctx.pendingPuddles || []).concat([{ x: site.cx, z: site.cz, r: site.len * 0.22 }]);
    return { name: surfLayer === LAYER.mud ? 'Mud Ruts' : style === 'wash' ? 'Erosion Ruts' : 'Clay Ruts', desc: 'Keep momentum through the deep ruts without getting stuck.', par: pick3(tier, [12, 16, 22]) };
  },

  // 4. steep incline, descent and side-slope traverse with an uneven ridgeline
  slopes(site, tier, style) {
    const climb = pick3(tier, [0.6, 1.0, 1.5]), side = Math.tan(pick3(tier, [10, 17, 24]) * Math.PI / 180);
    const { ctx } = site;
    shape(site, (u, v, h) => {
      const L = site.len / 2;
      const prof = u < -L * 0.2 ? smoothstep(-L, -L * 0.2, u) * climb : u < L * 0.25 ? climb : (1 - smoothstep(L * 0.25, L, u)) * climb;
      const tilt = (u > -L * 0.25 && u < L * 0.3) ? v * side : 0;
      const bumps = ctx.n.noise(u * 0.9 + site.cx, v * 0.9) * 0.05 * (1 + tier);
      return site.y + prof + tilt + bumps;
    }, 0.6);
    if (style === 'greasy') { paint(site, LAYER.dirt, () => 1, 0.5, true); paint(site, LAYER.mud, (u) => Math.abs(u) < site.len * 0.14 ? 0.8 : 0); } else paint(site, LAYER.rock, (u) => 0.3 + 0.3 * (1 - Math.abs(u) / site.len));
    return { name: 'Incline & Side Slope', desc: 'Climb, traverse the side slope and descend under control without rolling.', par: pick3(tier, [14, 18, 24]) };
  },

  // 5. log pile and timber steps: staggered logs, a crossed pair and a two-high step
  logPile(site, tier, style) {
    const r = pick3(tier, [0.08, 0.12, 0.17]);
    const beams = style === 'beams';
    const L = site.len / 2;
    const place = (u, v, length, rad, yawRel) => beams ? box(site, 'weathered', u, v, -0.02, rad * 2, length, rad * 1.7, SURF.WOOD, yawRel - Math.PI / 2) : log(site, u, v, length, rad, yawRel);
    place(-L + 1.6, 0, 2.6, r, Math.PI / 2 + 0.25);
    place(-L + 3.0, 0.3, 2.2, r * 1.15, Math.PI / 2 - 0.2);
    // crossed trunks
    place(-0.2, 0, 2.6, r, Math.PI / 2 + 0.55);
    place(0.4, 0, 2.6, r, Math.PI / 2 - 0.55);
    // timber step: one big log, or (intermediate+) a smaller log butted against a bigger one so
    // they form a two-step staircase with no gap for the truck to high-centre in
    if (tier === 0) place(L - 2.4, 0, 2.8, r * 1.35, Math.PI / 2);
    else { place(L - 2.6, 0, 2.8, r, Math.PI / 2); place(L - 2.6 + r * 2.5, 0, 2.6, r * 1.5, Math.PI / 2); }
    return { name: beams ? 'Timber Steps' : 'Log Pile', desc: 'Climb the staggered and crossed logs and the timber step.', par: pick3(tier, [12, 18, 26]) };
  },

  // 6. stunt ramps. At ~5.4 m/s a 1.2 m-wheelbase truck can't get all four wheels off a
  // ground-level kicker (the nose lands before the rear leaves the lip), so the air comes
  // from height instead: beginner rolls a low tabletop; intermediate/expert climb onto a
  // deck that ends in a kicked lip, carry the front wheels over a pit and drop onto a down-ramp.
  jump(site, tier) {
    const L = site.len / 2, u0 = Math.min(-L + 4.5, L - 9.3);   // ramps need 9.3 m; the rest is run-up
    if (tier === 0) {
      const H = 0.22, up = 1.8, top = 1.6, land = 2.4;
      shape(site, (u, v, h) => {
        if (Math.abs(v) > 1.5) return undefined;
        const e = 1 - smoothstep(1.1, 1.5, Math.abs(v)), x = u - u0;
        let dh = 0;
        if (x > 0 && x <= up) dh = H * smoothstep(0, up, x);
        else if (x > up && x <= up + top) dh = H;
        else if (x > up + top && x <= up + top + land) dh = H * (1 - smoothstep(0, land, x - up - top));
        return h + dh * e;
      }, 0.2);
    } else {
      const Hd = pick3(tier, [0, 0.5, 0.7]), kick = pick3(tier, [0, 0.08, 0.12]), R = 3.6, D = 1.3, kl = 0.6;
      const pit = pick3(tier, [0, 0.5, 0.7]), Lh = pick3(tier, [0, 0.22, 0.45]), land = pick3(tier, [0, 2.6, 3.2]);
      const face = pick3(tier, [0, 0.15, 0.5]);   // landing face: a short-falling truck can crawl back out
      const pf = pick3(tier, [0, 0, 0.25]);        // pit floor: a slow truck steps down instead of high-centring
      shape(site, (u, v, h) => {
        if (Math.abs(v) > 1.5) return undefined;
        const e = 1 - smoothstep(1.1, 1.5, Math.abs(v)), x = u - u0;
        let dh = 0;
        if (x > 0 && x <= R) dh = Hd * smoothstep(0, R, x);                                   // run-up ramp
        else if (x > R && x <= R + D) {                                                       // deck + kicked lip
          const k = x - (R + D - kl);
          dh = Hd + (k > 0 ? kick * (k / kl) * (k / kl) : 0);
        } else if (x > R + D && x <= R + D + pit) dh = pf;                                    // pit
        else if (x > R + D + pit && x <= R + D + pit + land) {                                // landing down-ramp
          const x1 = x - R - D - pit;
          dh = (pf + (Lh - pf) * smoothstep(0, face, x1)) * (1 - x1 / land);
        }
        return h + dh * e;
      }, 0.2);
    }
    paint(site, LAYER.dirt, () => 0.9);
    return { name: tier === 0 ? 'Tabletop Jump' : tier === 1 ? 'Step-Down Jump' : 'Drop-Off Jump', desc: tier === 0 ? 'Roll or jump the tabletop and land smoothly.' : 'Climb the deck in High range, launch off the lip, clear the pit and drop onto the down-ramp.', par: pick3(tier, [9, 10, 11]) };
  },

  // tyre field: staggered lying tyres and half-buried upright ones with narrow passages
  tires(site, tier) {
    const gapV = pick3(tier, [1.5, 1.2, 1.0]);
    for (let r = 0; r < 5; r++) {
      const u = -site.len / 2 + 1.7 + r * 1.35, off = (r % 2 ? 0.5 : -0.5) * gapV;
      for (const sg of [-1, 1]) tyre(site, u, off + sg * (gapV / 2 + 0.3), 0.26, 0.085, r % 2 === 1 && sg > 0);
      if (tier > 0 && r % 2 === 0) tyre(site, u + 0.65, -off, 0.22, 0.075, false);
    }
    return { name: 'Tyre Field', desc: 'Weave through the staggered tyres.', par: pick3(tier, [12, 15, 19]) };
  },

  // rock staircase: irregular rising slabs
  rockStairs(site, tier) {
    const step = pick3(tier, [0.07, 0.11, 0.15]);
    let lift = 0;
    for (let i = 0; i < 5; i++) {
      lift += step * site.rng.float(0.8, 1.2);
      rock(site, -site.len / 2 + 2 + i * 1.15, site.rng.float(-0.2, 0.2), 1.0 + site.rng.float(-0.1, 0.1), 'flat', { sy: 0.35, sink: 0.2, lift, yaw: site.yaw + site.rng.float(-0.2, 0.2), tilt: 0.05 });
    }
    return { name: 'Rock Staircase', desc: 'Climb the irregular rock steps one by one.', par: pick3(tier, [10, 14, 20]) };
  },

  // narrow ridge: a raised earth spine with drop-offs on both sides
  ridge(site, tier) {
    const H = pick3(tier, [0.35, 0.5, 0.7]), topW = pick3(tier, [1.35, 1.05, 0.9]);
    const { ctx } = site, L = site.len / 2;
    shape(site, (u, v, h) => {
      const along = smoothstep(-L, -L + 2.2, u) * (1 - smoothstep(L - 2.2, L, u));
      const prof = 1 - smoothstep(topW / 2, topW / 2 + 0.45, Math.abs(v));
      return site.y - 0.08 + (H * prof + ctx.n.noise(u * 1.2 + site.cx, 3) * 0.04 * (tier + 1)) * along;
    });
    paint(site, LAYER.gravel, (u, v) => 1 - Math.abs(v) / site.wid);
    return { name: 'Narrow Ridge', desc: 'Drive the raised ridge end to end without dropping off.', par: pick3(tier, [12, 16, 22]), rules: { minY: site.y + H * 0.4, zone: { x: site.cx, z: site.cz, r: L - 2.4 } } };
  },

  // rock garden maze: dense boulders around a meandering drivable line
  maze(site, tier) {
    const lane = pick3(tier, [1.7, 1.4, 1.15]);
    const lineV = (u) => Math.sin(u * 0.75) * 1.0;
    for (let u = -site.len / 2 + 0.8; u <= site.len / 2 - 0.8; u += 0.75) {
      for (let v = -site.wid / 2 + 0.4; v <= site.wid / 2 - 0.4; v += 0.75) {
        if (Math.abs(v - lineV(u)) < lane / 2 + 0.35) continue;
        if (site.rng.next() < 0.75) rock(site, u + site.rng.float(-0.15, 0.15), v + site.rng.float(-0.15, 0.15), site.rng.float(0.32, 0.5), 'boulder', { sink: 0.35 });
      }
    }
    paint(site, LAYER.gravel, () => 0.7);
    return { name: 'Rock Garden', desc: 'Find the line through the boulder garden.', par: pick3(tier, [16, 20, 26]) };
  },

  // water channel crossing: a rocky-bedded channel across the pad with shallow water
  channel(site, tier) {
    const depth = pick3(tier, [0.18, 0.26, 0.34]), w = pick3(tier, [1.6, 2.0, 2.4]);
    const { ctx } = site;
    shape(site, (u, v, h) => h - depth * (1 - smoothstep(w * 0.25, w * 0.5 + 0.4, Math.abs(u))));
    for (let i = 0; i < 10; i++) rock(site, site.rng.float(-w / 2, w / 2), site.rng.float(-site.wid / 2, site.wid / 2), site.rng.float(0.1, 0.22), 'boulder', { sink: 0.5 });
    const a = site.at(-w / 2 - 0.2, -site.wid / 2), b = site.at(w / 2 + 0.2, site.wid / 2);
    ctx.forEachNear(site.cx, site.cz, site.wid, (k, x, z) => { const [u] = site.local(x, z); if (Math.abs(u) < w / 2 + 0.3) ctx.wetW[k] = Math.max(ctx.wetW[k], 0.8); });
    ctx.water.push({ x0: Math.min(a.x, b.x) - 1, x1: Math.max(a.x, b.x) + 1, z0: Math.min(a.z, b.z) - 1, z1: Math.max(a.z, b.z) + 1, y: site.y - depth * 0.35, flow: [0.25, 0.05], murky: false,
      mask: (x, z) => { const [u, v] = site.local(x, z); return Math.abs(u) < w / 2 + 0.3 && Math.abs(v) < site.wid / 2; } });
    return { name: 'Water Channel', desc: 'Cross the rocky water channel without stalling.', par: pick3(tier, [9, 12, 15]) };
  },

  // sand dunes: rolling dunes of loose sand
  dunes(site, tier) {
    const H = pick3(tier, [0.4, 0.65, 0.95]);
    shape(site, (u, v, h) => site.y + Math.max(0, Math.sin((u / site.len + 0.5) * Math.PI * 3)) * H * (1 - smoothstep(site.wid * 0.3, site.wid * 0.5, Math.abs(v))) + v * 0.04, 0.4);
    paint(site, LAYER.sand, () => 1, 1);
    return { name: 'Dune Climb', desc: 'Climb the loose sand dunes without bogging down.', par: pick3(tier, [12, 15, 19]) };
  },

  // seesaw: a pivoting plank that tilts under the truck's weight
  seesaw(site, tier) {
    const halfLen = 1.75, halfWid = pick3(tier, [0.62, 0.55, 0.5]), pivotH = 0.24, thick = 0.05;
    const maxA = Math.asin(pivotH / halfLen);
    const p = site.at(0, 0);
    // fulcrum (static) and the moving plank (dynamic surface + mesh driven each frame)
    box(site, 'beam', 0, 0, 0, 0.3, halfWid * 2 - 0.1, pivotH, null);
    const plat = new SeesawPlatform(p.x, site.y + pivotH, p.z, site.yaw, halfLen, halfWid, thick, maxA);
    site.ctx.dynamics.push(plat);
    plat.meshSpec = { halfLen, halfWid, thick };
    return { name: 'Balance Seesaw', desc: 'Drive up the seesaw, balance it level, then roll off the far end.', par: pick3(tier, [10, 13, 16]) };
  },

  // suspension flex zone: offset mounds that lift diagonal wheels in turn
  flex(site, tier) {
    const H = pick3(tier, [0.12, 0.2, 0.3]);
    shape(site, (u, v, h) => {
      let dh = 0;
      for (let i = 0; i < 6; i++) {
        const cu = -site.len / 2 + 1.8 + i * 1.0, cv = (i % 2 ? 1 : -1) * 0.34;
        dh = Math.max(dh, H * Math.max(0, 1 - Math.hypot(u - cu, (v - cv) * 1.3) / 0.6));
      }
      return h + dh;
    });
    for (let i = 0; i < 3; i++) rock(site, -site.len / 2 + 2.3 + i * 2, (i % 2 ? -1 : 1) * 0.34, H * 1.6, 'flat', { sy: 0.4, sink: 0.4 });
    return { name: 'Flex Zone', desc: 'Work the suspension over the offset mounds.', par: pick3(tier, [10, 14, 18]) };
  },

  // gate slalom: breakable stakes in a zig-zag; touching one fails the run
  slalom(site, tier, style) {
    const w = pick3(tier, [1.6, 1.3, 1.12]);
    const n = 6;
    const gates = [];
    for (let i = 0; i < n; i++) {
      const u = -site.len / 2 + 1.5 + i * ((site.len - 3) / (n - 1)), cv = (i % 2 ? 0.8 : -0.8);
      stake(site, u, cv - w / 2, site.id); stake(site, u, cv + w / 2, site.id);
      const g = site.at(u, cv);
      if (i > 0 && i < n - 1) gates.push({ x: g.x, z: g.z, yaw: site.yaw, width: w, hidden: true });   // checkpoint line only; the stakes are the gate
    }
    const a = site.at(-site.len / 2 + 0.5, 0), b = site.at(site.len / 2 - 0.5, 0);
    return { name: 'Gate Slalom', desc: 'Weave through every pair of poles without touching one.', par: pick3(tier, [12, 15, 19]), rules: { noTouch: true },
      gates: [{ x: a.x, z: a.z, yaw: site.yaw, width: site.wid + 0.4 }, ...gates, { x: b.x, z: b.z, yaw: site.yaw, width: site.wid + 0.4 }] };
  },

  // precision crawl: narrow rock gaps with a dog-leg
  precision(site, tier) {
    const gap = pick3(tier, [1.3, 1.1, 0.98]);
    for (let i = 0; i < 4; i++) {
      const u = -site.len / 2 + 2 + i * 2, cv = i % 2 ? 0.45 : -0.45;
      for (const sg of [-1, 1]) rock(site, u, cv + sg * (gap / 2 + 0.38), 0.55, 'block', { sy: 1.1, sink: 0.25, yaw: site.yaw });
    }
    return { name: 'Precision Gaps', desc: 'Squeeze through the narrow rock gaps.', par: pick3(tier, [12, 16, 22]) };
  },

  // recovery challenge: a dead-end bay you must reverse out of after touching the far gate
  recovery(site, tier) {
    const w = pick3(tier, [2.6, 2.2, 1.9]);
    const L = site.len / 2;
    for (let u = -L + 0.6; u <= L; u += 0.8) for (const sg of [-1, 1]) rock(site, u, sg * (w / 2 + 0.35), 0.55, 'boulder', { sink: 0.3 });
    for (let v = -w / 2; v <= w / 2; v += 0.7) rock(site, L + 0.2, v, 0.55, 'block', { sy: 1, sink: 0.3 });
    for (let i = 0; i < 3; i++) rock(site, -L + 2 + i * 1.6, (i % 2 ? 1 : -1) * w * 0.22, 0.3, 'boulder', { sink: 0.4 });
    const a = site.at(-L + 0.4, 0), far = site.at(L - 1.4, 0);
    const g0 = { x: a.x, z: a.z, yaw: site.yaw, width: w }, g1 = { x: far.x, z: far.z, yaw: site.yaw, width: w };
    return { name: 'Recovery Bay', desc: 'Reach the back of the bay, then pick your line and reverse back out.', par: pick3(tier, [16, 20, 26]), gates: [g0, { ...g1, hidden: true }, { ...g0, hidden: true }] };
  },

  // multi-stage course: rock steps, a plank bridge, a slalom and a kicker in one run
  multi(site, tier) {
    const L = site.len / 2;
    // stage 1: rock steps
    let lift = 0;
    for (let i = 0; i < 3; i++) { lift += pick3(tier, [0.06, 0.08, 0.11]); rock(site, -L + 1.6 + i * 1.0, 0, 0.9, 'flat', { sy: 0.35, sink: 0.2, lift, yaw: site.yaw, tilt: 0.04 }); }
    // stage 2: plank bridge with ramps
    const H = 0.28, deckW = pick3(tier, [1.25, 1.1, 1.0]), b0 = -L + 6.0, Lb = 3.2;
    for (let i = 0; i < Lb / 0.16; i++) box(site, 'plank', b0 + 0.08 + i * 0.16, 0, H - 0.04, 0.145, deckW, 0.04);
    for (const sg of [-1, 1]) box(site, 'beam', b0 + Lb / 2, sg * (deckW / 2 - 0.08), 0, Lb, 0.08, H - 0.04);
    box(site, 'beam', b0 - 0.6, 0, H / 2 - 0.03, Math.hypot(1.2, H), deckW, 0.05, SURF.WOOD, 0, Math.atan2(H, 1.2));
    box(site, 'beam', b0 + Lb + 0.6, 0, H / 2 - 0.03, Math.hypot(1.2, H), deckW, 0.05, SURF.WOOD, 0, -Math.atan2(H, 1.2));
    // stage 3: pole slalom
    const s0 = b0 + Lb + 1.8, w = pick3(tier, [1.5, 1.3, 1.15]);
    for (let i = 0; i < 3; i++) { const u = s0 + i * 1.2, cv = i % 2 ? 0.55 : -0.55; stake(site, u, cv - w / 2, site.id); stake(site, u, cv + w / 2, site.id); }
    // stage 4: kicker, gap and landing ramp
    const k0 = L - 4.0, kh = pick3(tier, [0.22, 0.28, 0.34]), gap = pick3(tier, [0.0, 0.45, 0.7]);
    shape(site, (u, v, h) => {
      if (Math.abs(v) > 1.4) return undefined;
      const x = u - k0, e = 1 - smoothstep(1, 1.4, Math.abs(v));
      if (x > 0 && x < 1.4) return h + kh * Math.pow(x / 1.4, 1.25) * e;
      if (x >= 1.4 && x < 1.4 + gap) return h - 0.1 * e;
      if (x >= 1.4 + gap && x < 1.4 + gap + 1.8) return h + kh * 0.85 * (1 - (x - 1.4 - gap) / 1.8) * e;
      return undefined;
    });
    return { name: 'Multi-Stage Course', desc: 'Rock steps, a plank bridge, a pole slalom and a kicker in one clean run.', par: pick3(tier, [22, 28, 34]), rules: { noTouch: true } };
  },
};
