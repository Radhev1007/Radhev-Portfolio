// Trail obstacles: 20 to 30 crawling obstacles added along every terrain's main trail, on top of what the
// level already lays out. Each terrain has its own mix (RECIPES) and its own seed, so no two arrangements
// match, and the same seed builds the same course on every multiplayer client.
//
// Order sets difficulty: the first 20 % of a trail's obstacles are Beginner, the next 30 % Intermediate,
// 30 % Advanced and the last 20 % Extreme, so the trail gets harder the further you crawl.
//
// Everything is made of what the level pipeline already turns into physics: terrain shaping (the base
// heightfield), rocks and logs (rasterized into the physics heightfield at their real shapes), and prop
// geometry (concrete, tyres, beams, platforms) rasterized the same way, so each tyre meets exactly what it
// sees and climbs it on its own. Surfaces painted here (sand, gravel, mud, water) carry their own grip.
import * as THREE from 'three';
import { smoothstep, clamp } from '../core/noise.js';
import { SURF } from '../terrain/heightfield.js';

export const TIERS = ['Beginner', 'Intermediate', 'Advanced', 'Extreme'];
const LAYER = { rock: 0, dirt: 1, grass: 2, sand: 3, mud: 4, forest: 5, gravel: 6, wet: 7 };
const GAP = 0.7;           // m of trail left clear between two obstacles
const START = 6.5, END = 4; // m kept clear after the spawn and before the trail's end
const HALF = 1.55;         // m: half the trail's usable width for obstacles

/** Which tier the i-th of n obstacles is (20 / 30 / 30 / 20 %). */
export function tierFor(i, n) {
  const f = i / n;
  return f < 0.2 ? 0 : f < 0.5 ? 1 : f < 0.8 ? 2 : 3;
}

// ------------------------------------------------------------------ the kinds
// len: metres of trail it takes; min: the lowest tier it may appear at; build(o) lays it out.
const KINDS = {
  // ---- rock crawling
  scatter: { len: 3, min: 0, build(o) {
    for (let i = 0; i < 7 + o.k * 3; i++) o.rock(o.pick(['pebble', 'boulder', 'slab']), o.lat(), o.along(), o.r(0.12, 0.2 + o.k * 0.1), { sink: 0.4 });
  } },
  boulders: { len: 3.5, min: 0, build(o) {
    for (let i = 0; i < 3 + o.k; i++) // alternate sides, so the easier tiers always leave a line between them
    o.rock('boulder', (i % 2 ? 1 : -1) * o.r(o.k < 2 ? 0.5 : 0.2, 1.1), o.L * (i / (2 + o.k) - 0.5), o.r(0.15, 0.2) + o.k * 0.13, { sink: 0.45 });
  } },
  rockClimb: { len: 6, min: 1, build(o) {
    o.hump(0.35 + o.k * 0.22);
    for (let i = 0; i < 6 + o.k * 2; i++) o.rock(o.pick(['boulder', 'slab']), o.lat(), o.along(0.8), o.r(0.15, 0.25 + o.k * 0.07), { sink: 0.38 });
  } },
  sharpEdge: { len: 2.6, min: 1, build(o) {
    for (let i = 0; i < 3; i++) o.rock('block', (i - 1) * 0.95 + o.r(-0.15, 0.15), o.r(-0.6, 0.6), 0.32 + o.k * 0.11, { sink: 0.35, tilt: 0.22 + o.k * 0.06, sy: 0.9 });
  } },
  rockGarden: { len: 4.5, min: 1, build(o) {
    for (let i = 0; i < 12 + o.k * 5; i++) o.rock(o.pick(['boulder', 'slab', 'pebble', 'block']), o.lat(), o.along(), o.r(0.1, 0.2 + o.k * 0.08), { sink: 0.42 });
  } },
  narrowPassage: { len: 3.5, min: 1, build(o) {
    const gap = 1.3 - o.k * 0.08;   // the truck is 0.86 m wide over its tyres
    for (const s of [-1, 1]) for (const a of [-1, 0, 1]) o.rock('block', s * (gap / 2 + 0.45), a * 1.1, 0.75, { sy: 1.35, sink: 0.3 });
    if (o.k >= 2) for (let i = 0; i < 3; i++) o.rock('boulder', o.r(-0.3, 0.3), o.along(0.6), o.r(0.15, 0.24), { sink: 0.4 });
  } },
  steps: { len: 3.6, min: 0, build(o) {
    const h = 0.1 + o.k * 0.07;
    for (let s = 0; s < 3 + (o.k > 1 ? 1 : 0); s++) o.rock('flat', o.r(-0.2, 0.2), -o.L / 2 + 0.7 + s * 0.85, 0.85 + s * 0.1, { sx: 1.4, sy: (h * (s + 1.4)) / 0.85, sz: 0.85, yaw: o.yaw + o.r(-0.15, 0.15), tilt: 0.04, sink: 0.4, lift: s * h * 0.9 });
  } },
  // ---- technical crawling
  log: { len: 1.8, min: 0, build(o) { o.log(0, 0, 3.2, 0.11 + o.k * 0.06, o.r(-0.2, 0.2)); } },
  logs: { len: 3.6, min: 1, build(o) {
    const n = 2 + Math.min(2, o.k);
    for (let i = 0; i < n; i++) o.log(o.r(-0.3, 0.3), o.L * ((i + 0.5) / n - 0.5), o.r(2.4, 3.2), 0.1 + o.k * 0.04, o.r(-0.45, 0.45));
  } },
  fallenTrunk: { len: 3.2, min: 1, build(o) { o.log(0, 0, 5, 0.12 + o.k * 0.055, (o.rng.next() < 0.5 ? -1 : 1) * o.r(0.45, 0.75)); } },
  roots: { len: 3, min: 0, build(o) {
    for (let i = 0; i < 5 + o.k * 2; i++) o.log(o.lat(), o.along(), o.r(0.8, 1.6), 0.04 + o.k * 0.015, o.r(-1.2, 1.2));
  } },
  concrete: { len: 3, min: 0, build(o) {
    const h = 0.14 + o.k * 0.09;
    for (let i = 0; i < 2 + o.k; i++) o.box('concrete', o.r(-0.9, 0.9), o.L * (i / (1 + o.k) - 0.5), o.r(0.5, 0.8), h * o.r(0.8, 1.2), o.r(0.45, 0.7), o.r(-0.4, 0.4), SURF.ROCK);
  } },
  slabs: { len: 3.6, min: 0, build(o) {
    for (let i = 0; i < 4 + o.k; i++) o.rock('flat', o.lat(0.8), o.along(0.85), o.r(0.5, 0.85), { sy: (0.14 + o.k * 0.05) / 0.6, tilt: 0.03 + o.k * 0.05, yaw: o.r(0, 6.28), sink: 0.22 });
  } },
  tires: { len: 3.6, min: 1, build(o) {
    for (let i = 0; i < 4 + o.k * 2; i++) o.tyre(o.lat(0.85), o.along(0.85), 0.24, 0.08 + o.k * 0.01, o.k >= 2 && i % 3 === 0);
  } },
  beam: { len: 4.6, min: 2, build(o) {
    // twin balance beams at the truck's track width: wheels on the planks, the chassis over the gap
    const h = 0.12 + (o.k - 2) * 0.08, w = 0.24 - (o.k - 2) * 0.03;
    for (const s of [-1, 1]) o.plank(s * 0.34, 0, w, h, 3.2, true);
  } },
  platform: { len: 4.6, min: 1, build(o) { o.plank(0, 0, 1.7, 0.16 + o.k * 0.09, 2.4, true); } },
  // ---- off-road terrain
  mud: { len: 3.6, min: 0, build(o) { const p = o.at(0, 0); o.ctx.mudPit(p.x, p.z, 1.05 + o.k * 0.3, 0.045 + o.k * 0.05); } },
  dunes: { len: 5, min: 0, build(o) {
    const A = 0.1 + o.k * 0.07, lam = 2.3 - o.k * 0.2;
    o.ground((lat, al) => A * Math.sin((al / lam) * Math.PI * 2 + 1.2) * (1 - smoothstep(o.L / 2 - 1, o.L / 2, Math.abs(al))));
    o.paint(LAYER.sand, 0, 0, o.L / 2 + 1.2, 0.9);
  } },
  gravel: { len: 4, min: 0, build(o) {
    o.paint(LAYER.gravel, 0, 0, o.L / 2 + 1, 1);
    for (let i = 0; i < 26 + o.k * 10; i++) o.rock('pebble', o.lat(), o.along(), o.r(0.05, 0.1 + o.k * 0.03), { sink: 0.3, physics: o.k >= 2 });
    o.ground((lat, al) => o.n(lat * 2.1, al * 2.1) * (0.02 + o.k * 0.02));
  } },
  potholes: { len: 3.6, min: 0, build(o) {
    for (let i = 0; i < 3 + o.k; i++) o.hole(o.lat(0.7), o.along(0.8), o.r(0.45, 0.7), 0.1 + o.k * 0.07);
  } },
  uneven: { len: 4, min: 0, build(o) { o.ground((lat, al) => o.n(lat * 0.9, al * 0.9) * (0.05 + o.k * 0.06) * o.env(al)); } },
  hillUp: { len: 7, min: 1, build(o) { o.hump(0.6 + o.k * 0.3); } },
  descent: { len: 5, min: 1, build(o) {
    o.ground((lat, al) => -(0.2 + o.k * 0.16) * Math.sin(Math.PI * clamp((al + o.L / 2) / o.L, 0, 1)) * (1 - smoothstep(HALF + 0.5, HALF + 2.5, Math.abs(lat))));
    for (let i = 0; i < 5 + o.k * 2; i++) o.rock(o.pick(['boulder', 'slab']), o.lat(), o.along(0.7), o.r(0.14, 0.22 + o.k * 0.06), { sink: 0.4 });
  } },
  offCamberSlope: { len: 5, min: 1, build(o) {
    const s = (o.rng.next() < 0.5 ? -1 : 1) * (0.14 + o.k * 0.07);
    o.ground((lat, al) => clamp(lat, -HALF - 1, HALF + 1) * s * o.env(al));
  } },
  // ---- extreme challenges
  vGap: { len: 2.8, min: 2, build(o) {
    for (const s of [-1, 1]) o.rock('boulder', s * (0.55 + (o.k - 2) * 0.05), 0, 0.75 + o.k * 0.12, { sink: 0.35, sx: 1.2, sz: 0.9 });
  } },
  cliffPath: { len: 6, min: 2, build(o) {
    // one side of the trail drops away; the usable ledge narrows to ~1.2 m
    const side = o.rng.next() < 0.5 ? -1 : 1, H = 0.7 + (o.k - 2) * 0.4;
    o.ground((lat, al) => -H * smoothstep(0.55, 1.3, lat * side) * o.env(al) + 0.25 * smoothstep(-0.9, -1.6, lat * side) * o.env(al));
    for (let i = 0; i < 4; i++) o.rock('block', -side * o.r(1.05, 1.4), o.along(0.8), o.r(0.3, 0.5), { sy: 1.2, sink: 0.35 });
  } },
  boulderStep: { len: 3.2, min: 2, build(o) {
    o.rock('boulder', o.r(-0.2, 0.2), 0, 0.95 + (o.k - 2) * 0.25, { sink: 0.45, sx: 1.3, sz: 1.0 });
    for (let i = 0; i < 3; i++) o.rock('slab', o.r(-0.9, 0.9), -o.L / 2 + 0.4, o.r(0.25, 0.4), { sink: 0.35 });   // a ramp of small stuff in front
  } },
  water: { len: 4, min: 1, build(o) {
    const n = o.N, a = o.at(-HALF - 3.5, 0), b = o.at(HALF + 3.5, 0);
    const y = o.ctx.hf.baseHeightAt(o.at(0, 0).x, o.at(0, 0).z) - 0.04;
    // The game keeps a water body as a map-aligned box: anything lower than its surface inside the box is
    // under water. Where the trail bends back lower inside that box it would flood; make it a mud pit there.
    const w = 1.0 + o.k * 0.3, pad = w + 1.6 + 1;
    const x0 = Math.min(a.x, b.x) - pad, x1 = Math.max(a.x, b.x) + pad, z0 = Math.min(a.z, b.z) - pad, z1 = Math.max(a.z, b.z) + pad;
    const step = o.path.len / o.path.N, mine = o.t * o.path.len;
    const floods = o.path.pts.some((q, i) => Math.abs(i * step - mine) > o.L / 2 + 1.5 && q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1 && o.ctx.hf.baseHeightAt(q.x, q.z) < y + 0.06);
    if (floods) { KINDS.mud.build(o); return; }
    const prev = o.ctx.creekPath;
    const cross = new o.TrailPath([[a.x - n.x * 0.01, a.z - n.z * 0.01], [b.x, b.z]], 0.4);
    o.ctx.creek(cross, { waterY: y, width: w, depth: 0.16 + o.k * 0.08, bank: 1.6, flow: [n.x * 0.3, n.z * 0.3] });
    o.ctx.creekPath = prev;   // the level's own creek stays its creek
    for (let i = 0; i < 2 + o.k; i++) o.rock('boulder', o.lat(), o.r(-0.6, 0.6), o.r(0.16, 0.24 + o.k * 0.05), { sink: 0.35 });
  } },
  trench: { len: 2.4, min: 2, build(o) { o.ctx.crack(o.path, o.t, 0.25 + (o.k - 2) * 0.12, 0.45 + (o.k - 2) * 0.1, o.r(-0.5, 0.5)); } },
  multiLevel: { len: 3.8, min: 2, build(o) {
    const h = 0.18 + (o.k - 2) * 0.07;
    for (let s = 0; s < 3; s++) o.rock('flat', (s - 1) * 0.35, -o.L / 2 + 0.8 + s * 1.05, 0.95, { sx: 1.25, sy: (h * (s + 1)) / 0.95, sz: 1.0, tilt: 0.06, sink: 0.35, lift: s * h, yaw: o.yaw + o.r(-0.2, 0.2) });
  } },
  offCamberRock: { len: 4, min: 2, build(o) {
    const s = o.rng.next() < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) o.rock('flat', s * o.r(0, 0.6), o.L * (i / 2 - 0.5) * 0.8, 1.0, { sx: 1.5, sy: 0.35, sz: 1.0, tilt: 0.28 + (o.k - 2) * 0.1, yaw: o.yaw + Math.PI / 2 * s, sink: 0.3 });
  } },
  articulation: { len: 4.6, min: 1, build(o) {
    // humps and dips under alternate wheels: one corner up, the opposite down
    const A = 0.07 + o.k * 0.07;
    for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, al = -o.L / 2 + 0.8 + i * 1.05; o.bump(s * 0.34, al, 0.45, A); o.hole(-s * 0.34, al, 0.4, A * 0.6); }
  } },
};

// ------------------------------------------------------------------ each terrain's mix (kind: weight)
export const RECIPES = {
  canyon: { boulders: 3, rockClimb: 2, narrowPassage: 3, steps: 2, sharpEdge: 2, vGap: 2, multiLevel: 2, cliffPath: 2, rockGarden: 2, scatter: 2, descent: 1, offCamberRock: 1, trench: 1, boulderStep: 2, slabs: 1 },
  forest: { log: 2, logs: 3, fallenTrunk: 2, roots: 3, mud: 2, uneven: 2, scatter: 1, rockClimb: 1, hillUp: 1, potholes: 1, articulation: 2, steps: 1, platform: 1, beam: 1, slabs: 1, boulders: 1 },
  mud: { mud: 4, water: 2, potholes: 2, logs: 2, tires: 2, offCamberSlope: 2, uneven: 2, trench: 1, hillUp: 1, slabs: 1, articulation: 2, concrete: 1, gravel: 1, log: 1 },
  desert: { dunes: 4, gravel: 3, sharpEdge: 2, boulders: 2, rockClimb: 1, descent: 2, concrete: 2, slabs: 2, scatter: 2, steps: 1, vGap: 1, tires: 1, offCamberSlope: 1, boulderStep: 1 },
  creek: { water: 4, boulders: 2, slabs: 2, logs: 2, rockGarden: 2, scatter: 2, steps: 1, fallenTrunk: 1, mud: 1, offCamberRock: 1, articulation: 1, beam: 1, multiLevel: 1, potholes: 1 },
  ultimate: { rockGarden: 3, vGap: 2, articulation: 3, multiLevel: 2, offCamberRock: 2, boulderStep: 2, cliffPath: 1, trench: 1, steps: 1, concrete: 1, tires: 1, beam: 1, platform: 1, water: 1, mud: 1, sharpEdge: 1, narrowPassage: 1 },
};

const seedOf = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/**
 * Which stretches of the trail (arc length, m) are already taken: rocks, logs, mud and water the level put
 * there, challenge gates, lane signs; plus the start and the end.
 */
export function takenStretches(ctx, path, layout, clear = 2) {
  const step = path.len / path.N, taken = new Uint8Array(path.N + 1), hf = ctx.hf;
  const gates = [];
  for (const c of layout.challenges || []) for (const g of c.gates || []) gates.push(g);
  for (const m of ctx.markers || []) if (m.type === 'lane' || m.type === 'gate' || m.type === 'start' || m.type === 'finish') gates.push(m);
  // only what is on the trail and big enough to drive over counts: the scatter along its edges does not
  const rocks = ctx.rocks.instances.filter((r) => r.radius > 0.25);
  path.pts.forEach((q, i) => {
    const s = i * step;
    if (s < START || s > path.len - END) { taken[i] = 1; return; }
    const k = Math.round((q.z + hf.half) / hf.cell) * hf.v + Math.round((q.x + hf.half) / hf.cell);
    const under = (ctx.water || []).some((w) => q.x > w.x0 && q.x < w.x1 && q.z > w.z0 && q.z < w.z1 && hf.baseHeightAt(q.x, q.z) < w.y + 0.02);
    if ((ctx.mudW[k] || 0) > 0.2 || (ctx.wetW[k] || 0) > 0.3 || under) taken[i] = 1;   // under the level's water nothing would be seen
    else if (rocks.some((r) => Math.hypot(r.x - q.x, r.z - q.z) < r.radius + 0.35)) taken[i] = 1;
    else if ((ctx.logs || []).some((l) => Math.hypot(l.x - q.x, l.z - q.z) < l.length / 2 + 0.6)) taken[i] = 1;
    else if (gates.some((g) => Math.hypot(g.x - q.x, g.z - q.z) < 1.6)) taken[i] = 1;   // a gate line and a truck length round it
  });
  // keep `clear` m round what the level already has, so a new obstacle does not stack onto an old one into a
  // single combined trap (the spawn and end margins are not widened)
  const pad = Math.round(clear / step), grown = taken.slice();
  for (let i = 0; i < taken.length; i++) {
    const s = i * step;
    if (!taken[i] || s < START || s > path.len - END) continue;
    for (let j = Math.max(0, i - pad); j <= Math.min(taken.length - 1, i + pad); j++) grown[j] = 1;
  }
  return { taken: grown, step };
}

/**
 * Lay 20-30 obstacles along `layout.path` for terrain `def`. Returns the list placed, each
 * { kind, tier, tierName, t, s, len }, in trail order.
 */
export function addTrailObstacles(ctx, def, layout, TrailPath) {
  const recipe = RECIPES[def.id], path = layout.path;
  if (!recipe || !path) return [];
  const rng = { s: seedOf(def.id + ':trail') || 1, next() { this.s = (Math.imul(this.s ^ (this.s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; return this.s / 4294967296; } };
  let { taken, step } = takenStretches(ctx, path, layout, 2);
  const want = 20 + (seedOf(def.id) % 11);   // 20..30, different for each terrain
  const kinds = Object.keys(recipe);

  // fit `want` obstacles into the free stretches; if they do not all fit, shrink the footprints and retry.
  // A first pass picks the obstacles and packs them; the second spreads the spare trail evenly between them,
  // so a long trail does not end in one long empty stretch.
  let free = 0;
  const attempt = (n, shrink, slack) => {
    const r = { s: rng.s, next: rng.next };
    const out = [], uses = {}; let last = '', idx = Math.ceil(START / step), used = 0;
    while (out.length < n && idx <= path.N) {
      const k = tierFor(out.length, n);
      // a weighted pick among the kinds allowed at this tier: never the same kind twice running, and no kind
      // more than three times on one trail (so a trail never feels like one obstacle repeated)
      const pool = kinds.filter((x) => KINDS[x].min <= k && x !== last && (uses[x] || 0) < 3);
      const tot = pool.reduce((a, x) => a + recipe[x], 0);
      let u = r.next() * tot, kind = pool[0];
      for (const x of pool) { u -= recipe[x]; if (u <= 0) { kind = x; break; } }
      const len = KINDS[kind].len * shrink, need = Math.ceil((len + GAP) / step);
      const seed = r.next();
      // the next free run long enough for it
      let a = idx;
      while (a + need <= path.N) { let ok = true; for (let j = a; j < a + need; j++) if (taken[j]) { ok = false; a = j + 1; break; } if (ok) break; }
      if (a + need > path.N) return null;
      out.push({ kind, tier: k, tierName: TIERS[k], s: (a + need / 2) * step, t: (a + need / 2) / path.N, len, seed });
      used += need * step;
      idx = a + need + Math.round(slack / step); last = kind; uses[kind] = (uses[kind] || 0) + 1;
    }
    return out.length === n ? { out, used } : null;
  };
  let plan = null;
  // the widest clearance round the level's own obstacles that still fits 20, then compact footprints
  for (const clear of [2, 1, 0]) {
  if (plan) break;
  ({ taken } = takenStretches(ctx, path, layout, clear));
  free = taken.reduce((a, x) => a + (x ? 0 : step), 0);
  for (const shrink of [1, 0.85, 0.72, 0.62, 0.54, 0.47]) {   // compact footprints on the busiest trails
    for (let n = want; n >= 20 && !plan; n--) {
      const packed = attempt(n, shrink, 0);
      if (!packed) continue;
      const slack = Math.max(0, (free - packed.used) / n) * 0.8;
      plan = (slack > step && attempt(n, shrink, slack)?.out) || packed.out;
    }
    if (plan) break;
  }
  }
  if (!plan) return [];

  const props = ctx.props;   // created by the caller (activities' Props), shared with the activity sections
  for (const p of plan) KINDS[p.kind].build(makeOps(ctx, path, p, TrailPath, props));
  return plan;
}

// ------------------------------------------------------------------ the toolkit each kind builds with
function makeOps(ctx, path, p, TrailPath, props) {
  const hf = ctx.hf, b = hf.base, t = p.t, L = p.len;
  let s = Math.floor(p.seed * 4294967296) >>> 0 || 1;
  const rng = { next() { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; return s / 4294967296; } };
  const r = (a, c) => a + (c - a) * rng.next();
  const P = path.at(t), T = path.tangent(t), N = path.normal(t), yaw = path.yaw(t);
  const at = (lat, al) => ({ x: P.x + N.x * lat + T.x * al, z: P.z + N.z * lat + T.z * al });
  const local = (x, z) => ({ lat: (x - P.x) * N.x + (z - P.z) * N.z, al: (x - P.x) * T.x + (z - P.z) * T.z });
  const env = (al) => 1 - smoothstep(L / 2 - 0.9, L / 2 + 0.4, Math.abs(al));
  const o = {
    ctx, path, t, k: p.tier, L, yaw, rng, N, TrailPath, at, env, r,
    pick: (a) => a[Math.floor(rng.next() * a.length)],
    lat: (f = 1) => r(-HALF, HALF) * f,
    along: (f = 1) => r(-L / 2, L / 2) * f,
    n: (x, z) => ctx.n.noise(P.x * 0.37 + x, P.z * 0.37 + z),
    rock(kind, lat, al, size, opts = {}) {
      const q = at(lat, al), y = hf.baseHeightAt(q.x, q.z) + (opts.lift || 0);
      const { lift, ...rest } = opts;
      ctx.rocks.add(ctx.rng, kind, q.x, y, q.z, size, { yaw: r(0, 6.28), ...rest });
    },
    log(lat, al, length, radius, yawOff = 0) { const q = at(lat, al); ctx.addLog(q.x, q.z, length, radius, yaw + Math.PI / 2 + yawOff); },
    // shape the ground: dh(lat, along) metres added to the base heights over the obstacle's footprint
    ground(dh) {
      ctx.forEachNear(P.x, P.z, L / 2 + HALF + 3, (k, x, z) => { const l = local(x, z); if (Math.abs(l.al) > L / 2 + 1 || Math.abs(l.lat) > HALF + 3) return; b[k] += dh(l.lat, l.al); });
    },
    hump(h) { o.ground((lat, al) => h * Math.sin(Math.PI * clamp((al + L / 2) / L, 0, 1)) ** 2 * (1 - smoothstep(HALF + 0.5, HALF + 2.8, Math.abs(lat)))); },
    bump(lat, al, rad, h) { const c = at(lat, al); ctx.forEachNear(c.x, c.z, rad, (k, x, z, d) => { b[k] += h * (1 - smoothstep(0, rad, d)); }); },
    hole(lat, al, rad, d) { const c = at(lat, al); ctx.forEachNear(c.x, c.z, rad, (k, x, z, dd) => { b[k] -= d * (1 - (dd / rad) ** 2); }); },
    paint(layer, lat, al, rad, str) { const c = at(lat, al); ctx.paintLayerAt(c.x, c.z, rad, layer, str); },
    // prop geometry in world space; rasterized into the physics heightfield as `surf`
    box(mat, lat, al, w, h, d, yawOff, surf) {
      const q = at(lat, al), y = Math.min(hf.baseHeightAt(q.x, q.z), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => { const e = at(lat + a * w / 2, al + c * d / 2); return hf.baseHeightAt(e.x, e.z); }));
      const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2 - 0.03, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw + yawOff)); g.translate(q.x, y, q.z);
      props.add(mat, g, surf);
    },
    tyre(lat, al, R, tube, stacked) {
      const q = at(lat, al), y = hf.baseHeightAt(q.x, q.z);
      for (let lvl = 0; lvl < (stacked ? 2 : 1); lvl++) {
        const g = new THREE.TorusGeometry(R, tube, 8, 18); g.rotateX(Math.PI / 2);
        g.translate(q.x, y + tube * (0.7 + lvl * 1.9), q.z);
        props.add('tyre', g, SURF.ROCK);
      }
    },
    // a raised plank (balance beam or deck) along the trail, with ramps at both ends
    plank(lat, al, w, h, len, ramps) {
      const q = at(lat, al), y = hf.baseHeightAt(q.x, q.z);
      const deck = new THREE.BoxGeometry(w, 0.06, len); deck.translate(0, h, 0);
      const parts = [deck];
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) { const leg = new THREE.BoxGeometry(0.06, h, 0.06); leg.translate(sx * (w / 2 - 0.05), h / 2, sz * (len / 2 - 0.1)); parts.push(leg); }
      for (const g of parts) { g.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)); g.translate(q.x, y, q.z); props.add('beam', g, SURF.WOOD); }
      if (ramps) for (const e of [-1, 1]) {
        const rl = Math.max(0.6, h / Math.tan(0.42)), ramp = new THREE.BoxGeometry(w, 0.05, Math.hypot(rl, h));
        ramp.applyMatrix4(new THREE.Matrix4().makeRotationX(e * Math.atan2(h, rl)));
        ramp.translate(0, h / 2, e * (len / 2 + rl / 2));
        ramp.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)); ramp.translate(q.x, y, q.z);
        props.add('plank', ramp, SURF.WOOD);
      }
    },
  };
  return o;
}
