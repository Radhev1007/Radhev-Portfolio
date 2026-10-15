// The six terrain areas. Each definition shapes its heightfield, lays out a trail with obstacle lines,
// paints surfaces, grows vegetation and defines challenges.
import * as THREE from 'three';
import { smoothstep, clamp, lerp } from '../core/noise.js';

// splat layer indices: 0 rock 1 dirt 2 grass 3 sand 4 mud 5 forest 6 gravel 7 wet

// ------------------------------------------------------------------ shared helpers
function heroRock(ctx, x, z, yaw) {
  const h = ctx.hf.baseHeightAt(x, z);
  ctx.rocks.add(ctx.rng, 'flat', x, h + 0.1, z, 1.7, { sx: 1.25, sy: 0.32, sz: 1.5, yaw, tilt: 0.03, sink: 0.2 });
  ctx.noVeg.push({ x, z, r: 4 });
}

function spawnFrom(path, t = 0.0) {
  const p = path.offset(t, 0, 0);
  return { x: p.x, z: p.z, yaw: path.yaw(t) };
}

function vIdx(ctx, x, z) {
  const hf = ctx.hf;
  const i = clamp(Math.round((x + hf.half) / hf.cell), 0, hf.n), j = clamp(Math.round((z + hf.half) / hf.cell), 0, hf.n);
  return j * hf.v + i;
}

function nearTrail(ctx, x, z, r) {
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (ctx.trailW[vIdx(ctx, x + dx, z + dz)] > 0.02) return true;
  return false;
}

function onRock(ctx, x, z) { return ctx.hf.heightAt(x, z) - ctx.hf.baseHeightAt(x, z) > 0.04; }
function inWater(ctx, x, z) { return ctx.hf.waterDepthAt(x, z) > -0.05 && ctx.hf.waterBodies?.some((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && ctx.hf.baseHeightAt(x, z) < w.y + 0.08); }

function plantTrees(ctx, count, o = {}) {
  const hf = ctx.hf, rng = ctx.rng;
  ctx.scatter(count, (x, z) => {
    if (!ctx.clearAt(x, z)) return false;
    if (o.clump !== undefined && ctx.n.noise(x * 0.045 + 5, z * 0.045) < o.clump) return false;
    if (ctx.slopeAt(x, z) < (o.minNy ?? 0.82)) return false;
    const s = rng.float(o.minH ?? 22, o.maxH ?? 55);
    const tr = s * 0.016 + 0.6;
    if (nearTrail(ctx, x, z, tr + 0.8) || onRock(ctx, x, z) || inWater(ctx, x, z)) return false;
    if (o.region && !o.region(x, z)) return false;
    ctx.veg.addTree(x, hf.baseHeightAt(x, z) - 0.2, z, s, rng.float(0, 6.28));
    ctx.noVeg.push({ x, z, r: tr + 0.3 });
    return true;
  }, 6);
}

function plantGround(ctx, o) {
  const hf = ctx.hf, rng = ctx.rng, D = ctx.densityScale;
  // bushes
  ctx.scatter(Math.round((o.bushes || 0) * D), (x, z) => {
    if (!ctx.clearAt(x, z) || nearTrail(ctx, x, z, 1.0) || onRock(ctx, x, z) || inWater(ctx, x, z)) return false;
    if (ctx.slopeAt(x, z) < 0.75) return false;
    if (o.region && !o.region(x, z)) return false;
    ctx.veg.addBush(x, hf.baseHeightAt(x, z) - 0.1, z, rng.float(0.6, 1.5), !!o.dryBush);
    return true;
  });
  // grass tufts — clustered, allowed up to the trail edge
  const gN = Math.round((o.grass || 0) * D * 1.5); // card tufts are cheap: plant denser
  ctx.scatter(gN, (x, z) => {
    if (ctx.n2.noise(x * 0.09, z * 0.09) < (o.grassClump ?? -0.1)) return false;
    const k = vIdx(ctx, x, z);
    if (ctx.trailW[k] > 0.45 || onRock(ctx, x, z) || inWater(ctx, x, z) || ctx.mudW[k] > 0.5) return false;
    if (ctx.slopeAt(x, z) < 0.7) return false;
    if (o.region && !o.region(x, z)) return false;
    // skip the lip of steep drops (banks, ledges) where the card base would poke out of the face
    const h0 = hf.baseHeightAt(x, z);
    for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) if (h0 - hf.baseHeightAt(x + dx, z + dz) > 0.1) return false;
    const dry = o.dryGrass === true || (o.dryGrass && rng.chance(o.dryGrass));
    // mix of short lawn tufts and taller clumps; taller where the clump noise is strongest
    const clump = ctx.n2.noise(x * 0.09, z * 0.09);
    const sc = rng.chance(0.35) ? rng.float(0.25, 0.5) : rng.float(0.5, 0.85) + Math.max(0, clump) * 0.45;
    ctx.veg.addGrass(x, hf.baseHeightAt(x, z), z, sc * (o.grassScale || 1), dry);
    return true;
  }, 3);
  // fallen branches
  ctx.scatter(Math.round((o.branches || 0)), (x, z) => {
    if (onRock(ctx, x, z) || inWater(ctx, x, z) || ctx.slopeAt(x, z) < 0.85) return false;
    ctx.veg.addBranch(x, hf.baseHeightAt(x, z), z, rng.float(0.7, 1.4), rng.float(0, 6.28));
    return true;
  });
  // yucca
  ctx.scatter(Math.round((o.yucca || 0) * D), (x, z) => {
    if (!ctx.clearAt(x, z) || nearTrail(ctx, x, z, 0.9) || onRock(ctx, x, z)) return false;
    ctx.veg.addYucca(x, hf.baseHeightAt(x, z) - 0.05, z, rng.float(0.7, 1.4));
    return true;
  });
}

// roots radiating from trees that stand close to the trail (crawlable bumps)
function plantRoots(ctx, maxDist = 6) {
  const hf = ctx.hf, rng = ctx.rng;
  for (const t of ctx.veg.trees) {
    if (!nearTrail(ctx, t.x, t.z, maxDist)) continue;
    const n = rng.int(4, 6), trunkR = t.s * 0.016;
    for (let r = 0; r < n; r++) {
      const a = rng.float(0, Math.PI * 2), L = rng.float(2.5, 5.5), rad = rng.float(0.04, 0.085) * (t.s / 60 + 0.7);
      const pts = [];
      for (let s = 0; s <= 6; s++) {
        const d = trunkR * 0.8 + (s / 6) * L, wob = Math.sin(s * 1.3 + r) * 0.25;
        const x = t.x + Math.cos(a + wob * 0.2) * d, z = t.z + Math.sin(a + wob * 0.2) * d;
        pts.push(new THREE.Vector3(x, hf.baseHeightAt(x, z) + rad * (0.35 - s / 20) + (s === 0 ? 0.12 : 0), z));
      }
      ctx.veg.makeRoot(pts, rad * (1 - 0.0));
    }
  }
}

function scatterRocks(ctx, n, o = {}) {
  const rng = ctx.rng, hf = ctx.hf;
  ctx.scatter(Math.round(n), (x, z) => {
    if (o.region && !o.region(x, z)) return false;
    const k = vIdx(ctx, x, z);
    if (!o.onTrail && ctx.trailW[k] > (o.trailMax ?? 0.15)) return false;
    if (o.notWater && inWater(ctx, x, z)) return false;
    const size = rng.float(o.min ?? 0.1, o.max ?? 0.4);
    const ny = ctx.slopeAt(x, z);
    if (ny < 0.6) return false;
    // on slopes, sit the rock at the downhill height so it doesn't hover
    let hmin = hf.baseHeightAt(x, z);
    for (const [dx, dz] of [[size, 0], [-size, 0], [0, size], [0, -size]]) hmin = Math.min(hmin, hf.baseHeightAt(x + dx * 0.8, z + dz * 0.8));
    ctx.rocks.add(rng, o.kinds ? rng.pick(o.kinds) : rng.pick(['boulder', 'pebble', 'slab', 'block']), x, hmin, z, size, { sink: o.sink ?? 0.35, physics: o.physics });
    if (size > 1) ctx.noVeg.push({ x, z, r: size * 1.2 });
    return true;
  });
}

// pebbles / gravel stones along trail edges and everywhere (visual + physics)
function pebbles(ctx, n, o = {}) {
  scatterRocks(ctx, n * ctx.densityScale, { min: 0.04, max: 0.12, kinds: ['pebble'], onTrail: true, sink: 0.4, ...o });
}

function stakesCorridor(ctx, path, t0, t1, half = 0.75, spacing = 1.1, id) {
  const steps = Math.floor(((t1 - t0) * path.len) / spacing);
  for (let s = 0; s <= steps; s++) {
    const t = t0 + (s / steps) * (t1 - t0);
    for (const sg of [-1, 1]) { const p = path.offset(t, sg * half); ctx.markers.push({ type: 'stake', x: p.x, z: p.z, id }); }
  }
}

function gateAt(ctx, path, t, lat = 0, width = 2.4, id, kind = 'gate') {
  const p = path.offset(t, lat);
  const g = { x: p.x, z: p.z, yaw: path.yaw(t), width };
  ctx.markers.push({ type: kind, ...g, id });
  return g;
}

// common surface helpers
const W = (w, a) => { for (let i = 0; i < a.length; i++) w[i] = a[i]; };

// ================================================================== 1. ROCKY CANYON
const rockyCanyon = {
  previewT: 0.25,
  id: 'canyon', name: 'Rocky Canyon', stars: 4, technical: 'High', terrain: 'Rocks / Cliffs', difficulty: 'High',
  est: '6–9 min', maxSlope: '38°', bestFor: 'Advanced crawling', biome: 'canyon', seed: 11,
  env: { moss: 0.15, topLayer: 3, dust: 0.55, snow: 1e4, warm: 0.14 },
  backdrop: { edgeHeight: 16, peak: 160, hills: 40, mesa: 70, trees: 0 },
  backdropSplat: (x, z, h, ny) => [0.55 + (1 - ny), 0.15, 0, 0.3, 0, 0, 0.1, 0],
  trailLayer: 3,
  build(ctx) {
    ctx.rocks.warmBase = 0.14;
    const path = ctx.path([[-8, -50], [0, -42], [9, -32], [7, -20], [-4, -10], [-10, 2], [-3, 14], [9, 22], [14, 33], [7, 43], [-3, 49]]);
    const D = ctx.distanceField(path, 34);
    ctx.D = D;
    const n = ctx.n;
    ctx.fill((x, z) => {
      const d = D(x, z) + n.noise(x * 0.06, z * 0.06) * 2.2;
      const rise = (z + 50) * 0.055;
      const wall = smoothstep(5.5, 10, d) * (9 + n.ridged(x * 0.03, z * 0.03, 4) * 9) + smoothstep(12, 30, d) * 7;
      const floor = n.fbm(x * 0.08, z * 0.08, 4) * 0.45 + n.fbm(x * 0.3, z * 0.3, 2) * 0.08;
      const terr = Math.round(wall / 1.6) * 1.6 * 0.35 + wall * 0.65; // stratified terraces on walls
      return rise + floor + terr;
    });
    ctx.edgeWalls(14, 54, 8);
    // summit dome at the end
    const end = path.at(1);
    ctx.hill(end.x, end.z, 9, 3.2, 1.5);
    const widthFn = (t, w) => {
      let b = 0; for (const o of [0.12, 0.27, 0.46, 0.7]) b = Math.max(b, 1 - smoothstep(0.02, 0.06, Math.abs(t - o)));
      return w + b * 2.0;
    };
    ctx.carvePath(path, { width: 2.2, fall: 2.5, smooth: 5, ruts: 0.03, widthFn });
    ctx.crack(path, 0.37, 0.32, 0.55, 0.4);
    ctx.crack(path, 0.58, 0.26, 0.45, -0.5);
    ctx.obstacle(path, 0.12, 'rocks');
    ctx.obstacle(path, 0.27, 'ledges', { length: 7 });
    ctx.obstacle(path, 0.46, 'boulders', { length: 7 });
    ctx.obstacle(path, 0.70, 'ledges', { length: 6, lanes: [{ lat: 2.2, diff: 'medium' }, { lat: -2.2, diff: 'hard' }] });
    // narrow passage between towering boulders
    const np = 0.6;
    for (const sg of [-1, 1]) { const p = path.offset(np, sg * 1.75); ctx.rocks.add(ctx.rng, 'block', p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, 1.15, { sy: 1.6, sink: 0.3 }); }
    // stair-stepped summit climb
    for (let s = 0; s < 5; s++) {
      const p = path.offset(0.9 + s * 0.02, (s % 2 ? 0.5 : -0.5), 0);
      ctx.rocks.add(ctx.rng, 'slab', p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, 0.7 + s * 0.06, { sink: 0.5, yaw: path.yaw(0.9) });
    }
    // canyon walls: towering cliff rocks along both sides
    const rng = ctx.rng;
    for (let i = 0; i <= path.N; i += 7) {
      const P = path.pts[i], T = path.tan[i];
      for (const sg of [-1, 1]) {
        const lat = sg * rng.float(6.5, 10);
        const x = P.x - T.z * lat, z = P.z + T.x * lat;
        const sz = rng.float(2.2, 4.5);
        ctx.rocks.add(rng, rng.chance(0.6) ? 'cliff' : 'block', x, ctx.hf.baseHeightAt(x, z), z, sz, { sy: rng.float(1.2, 2.2), sink: 0.25, tilt: 0.08 });
        if (rng.chance(0.5)) {
          const lat2 = lat + sg * rng.float(3, 6);
          const x2 = P.x - T.z * lat2, z2 = P.z + T.x * lat2;
          ctx.rocks.add(rng, 'cliff', x2, ctx.hf.baseHeightAt(x2, z2), z2, rng.float(3, 6), { sy: rng.float(1.4, 2.6), sink: 0.2 });
        }
      }
    }
    // floor boulders & loose stones
    scatterRocks(ctx, 220, { min: 0.3, max: 1.4, region: (x, z) => D(x, z) > 3.2 && D(x, z) < 9 });
    scatterRocks(ctx, 260, { min: 0.08, max: 0.3, region: (x, z) => D(x, z) < 6, trailMax: 0.9 });
    pebbles(ctx, 900, { region: (x, z) => D(x, z) < 7 });
    heroRock(ctx, path.offset(0.0, 0, -1.5).x, path.offset(0.0, 0, -1.5).z, path.yaw(0));

    const ch = [];
    { // Rock Climb
      const id = 'climb';
      const g0 = gateAt(ctx, path, 0.84, 0, 3.2, id, 'start');
      const g1 = gateAt(ctx, path, 0.995, 0, 2.6, id, 'finish');
      ch.push({ id, name: 'Rock Climb', desc: 'Reach the summit without rolling over.', rules: { noRollover: true }, gates: [g0, g1] });
    }
    { // Technical line through the hard lines
      const id = 'technical';
      const g0 = gateAt(ctx, path, 0.22, 0, 5.5, id, 'start');
      const g1 = gateAt(ctx, path, 0.27 + 0.016, -2.4, 1.6, id);
      const g2 = gateAt(ctx, path, 0.46 + 0.016, -2.4, 1.6, id);
      const g3 = gateAt(ctx, path, 0.52, 0, 3.5, id, 'finish');
      ch.push({ id, name: 'Technical Line', desc: 'Take the black-diamond lines through the ledges and boulder field.', rules: { noRollover: true }, gates: [g0, g1, g2, g3] });
    }
    return { spawn: spawnFrom(path, 0), path, challenges: ch, introTarget: path.at(0) };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const d = ctx.D(x, z), n = ctx.n.noise(x * 0.15, z * 0.15);
    W(w, [smoothstep(4.5, 8, d) * 0.9, 0.35 + n * 0.2, 0, 0.55, 0, 0, smoothstep(0.2, 0.6, ctx.n2.noise(x * 0.2, z * 0.2)) * 0.6, 0]);
  },
  vegetation(ctx) {
    plantGround(ctx, { bushes: 70, dryBush: true, grass: 3500, dryGrass: 0.8, branches: 12, yucca: 30, grassClump: 0.1, region: (x, z) => ctx.D(x, z) > 2.5 });
    plantTrees(ctx, 30 * ctx.densityScale + 10, { minH: 20, maxH: 40, minNy: 0.85, region: (x, z) => ctx.D(x, z) > 12 });
  },
};

// ================================================================== 2. PINE FOREST
const pineForest = {
  previewT: 0.2,
  id: 'forest', name: 'Pine Forest', stars: 3, technical: 'Medium', terrain: 'Dirt / Trees', difficulty: 'Medium',
  est: '5–7 min', maxSlope: '32°', bestFor: 'Trail crawling', biome: 'forest', seed: 22,
  env: { moss: 0.85, topLayer: 5, dust: 0, snow: 120 },
  backdrop: { edgeHeight: 14, peak: 300, hills: 40, trees: 3, treeLine: 110 },
  backdropSplat: (x, z, h, ny) => [1 - ny + (h > 100 ? 0.5 : 0), 0.1, 0.4, 0, 0, 0.6, 0, 0],
  trailLayer: 1,
  build(ctx) {
    const n = ctx.n;
    ctx.fill((x, z) => n.fbm(x * 0.022, z * 0.022, 5) * 4.5 + n.fbm(x * 0.09, z * 0.09, 3) * 0.6 + 2);
    ctx.hill(19, 17, 15, 6.5, 1.2);
    ctx.hill(-30, 24, 12, 3.5);
    ctx.edgeWalls(16, 54, 8);
    const path = ctx.path([[-40, -44], [-31, -34], [-29, -20], [-18, -11], [-4, -14], [10, -24], [24, -20], [31, -8], [26, 4], [19, 17], [7, 30], [-9, 36], [-25, 31], [-36, 18], [-44, 5]]);
    ctx.carvePath(path, { width: 1.7, fall: 2.4, smooth: 3.5, ruts: 0.06, widthFn: (t, w) => {
      let b = 0; for (const o of [0.1, 0.22, 0.78]) b = Math.max(b, 1 - smoothstep(0.02, 0.055, Math.abs(t - o)));
      return w + b * 2.2;
    } });
    ctx.D = ctx.distanceField(path, 20);
    ctx.obstacle(path, 0.10, 'logs');
    ctx.obstacle(path, 0.22, 'rocks');
    ctx.obstacle(path, 0.78, 'boulders', { length: 7 });
    ctx.crack(path, 0.88, 0.25, 0.5, 0.3);
    // hill climb: scattered rocks on the slope
    for (let i = 0; i < 14; i++) { const p = ctx.path === null ? null : path.offset(ctx.rng.float(0.45, 0.56), ctx.rng.float(-1.2, 1.2)); ctx.rocks.add(ctx.rng, 'boulder', p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, ctx.rng.float(0.15, 0.4)); }
    // logs across the precision corridor approach and decorative fallen logs
    ctx.addLog(path.offset(0.6, 0).x, path.offset(0.6, 0).z, 3.2, 0.18, path.yaw(0.6) + Math.PI / 2 + 0.3);
    for (let i = 0; i < 14; i++) {
      const x = ctx.rng.float(-48, 48), z = ctx.rng.float(-48, 48);
      if (ctx.D(x, z) > 4) ctx.addLog(x, z, ctx.rng.float(4, 9), ctx.rng.float(0.25, 0.5), ctx.rng.float(0, 6.28));
    }
    // mossy boulders in the woods
    scatterRocks(ctx, 120, { min: 0.4, max: 2.2, region: (x, z) => ctx.D(x, z) > 3.5 });
    scatterRocks(ctx, 200, { min: 0.1, max: 0.3, trailMax: 0.6 });
    pebbles(ctx, 600, { region: (x, z) => ctx.D(x, z) < 4 });
    heroRock(ctx, path.offset(0, 0, -1.5).x, path.offset(0, 0, -1.5).z, path.yaw(0));
    const ch = [];
    { const id = 'hill';
      const g0 = gateAt(ctx, path, 0.43, 0, 3.4, id, 'start');
      const g1 = gateAt(ctx, path, 0.56, 0, 3.4, id, 'finish');
      ch.push({ id, name: 'Hill Climb', desc: 'Reach the top of the steep forest hill.', rules: { noRollover: true }, gates: [g0, g1] }); }
    { const id = 'precision';
      stakesCorridor(ctx, path, 0.63, 0.71, 0.72, 1.0, id);
      const g0 = gateAt(ctx, path, 0.625, 0, 1.6, id, 'start');
      const g1 = gateAt(ctx, path, 0.715, 0, 1.6, id, 'finish');
      ch.push({ id, name: 'Precision Crawl', desc: 'Thread the staked trail without touching a marker.', rules: { noTouch: true }, gates: [g0, g1] }); }
    return { spawn: spawnFrom(path, 0), path, challenges: ch };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const g = smoothstep(-0.1, 0.4, ctx.n2.noise(x * 0.05, z * 0.05));
    W(w, [0, 0.1 + smoothstep(0.3, 0.7, ctx.n.noise(x * 0.2, z * 0.2)) * 0.4, g * 0.9, 0, 0, 1 - g * 0.6, 0, 0]);
  },
  vegetation(ctx) {
    plantTrees(ctx, Math.round(260 * Math.min(1.2, ctx.densityScale + 0.3)), { minH: 26, maxH: 70, clump: -0.35 });
    plantRoots(ctx, 4.5);
    plantGround(ctx, { bushes: 420, grass: 26000, branches: 90, grassClump: 0.0 });
  },
};

// ================================================================== 3. MUD TRAIL
const mudTrail = {
  previewT: 0.25,
  id: 'mud', name: 'Mud Trail', stars: 2.5, technical: 'Medium', terrain: 'Mud / Wet Terrain', difficulty: 'Medium',
  est: '4–6 min', maxSlope: '26°', bestFor: 'Traction control', biome: 'mud', seed: 33,
  env: { moss: 0.7, topLayer: 5, dust: 0, snow: 140, wetBias: 0.25 },
  backdrop: { edgeHeight: 12, peak: 240, hills: 35, trees: 3, treeLine: 120 },
  backdropSplat: (x, z, h, ny) => [1 - ny, 0.2, 0.7, 0, 0, 0.3, 0, 0],
  trailLayer: 1,
  build(ctx) {
    const n = ctx.n;
    ctx.fill((x, z) => n.fbm(x * 0.025, z * 0.025, 5) * 3 + n.fbm(x * 0.12, z * 0.12, 2) * 0.25 + 1.5);
    ctx.hill(28, 18, 11, 3.6, 1);
    ctx.edgeWalls(13, 54, 6);
    const path = ctx.path([[-46, -40], [-34, -31], [-20, -31], [-8, -20], [0, -6], [-6, 8], [-2, 22], [12, 28], [26, 21], [34, 8], [42, -6], [46, -22]]);
    ctx.carvePath(path, { width: 2.1, fall: 2.6, smooth: 4, ruts: 0.1, crown: 0.03 });
    ctx.D = ctx.distanceField(path, 20);
    const pits = [0.13, 0.27, 0.41, 0.56, 0.86];
    pits.forEach((t, i) => { const p = path.offset(t, ctx.rng.float(-0.6, 0.6)); ctx.mudPit(p.x, p.z, 2.6 + (i % 3) * 0.7, 0.28 + (i % 2) * 0.1); });
    // mud hill
    for (let t = 0.66; t < 0.78; t += 0.01) { const p = path.offset(t, 0); ctx.paintLayerAt(p.x, p.z, 2.6, 4, 0.9); }
    ctx.obstacle(path, 0.2, 'rocks', { lanes: [{ lat: 1.2, diff: 'easy' }, { lat: -1.2, diff: 'medium' }], length: 5 });
    ctx.obstacle(path, 0.49, 'logs', { lanes: [{ lat: 0, diff: 'medium' }], signs: false });
    scatterRocks(ctx, 160, { min: 0.1, max: 0.6, trailMax: 0.3 });
    scatterRocks(ctx, 40, { min: 0.8, max: 2.0, region: (x, z) => ctx.D(x, z) > 4 });
    pebbles(ctx, 500, { region: (x, z) => ctx.D(x, z) < 4 });
    for (let i = 0; i < 8; i++) { const x = ctx.rng.float(-45, 45), z = ctx.rng.float(-45, 45); if (ctx.D(x, z) > 4) ctx.addLog(x, z, ctx.rng.float(3, 7), ctx.rng.float(0.2, 0.4), ctx.rng.float(0, 6)); }
    heroRock(ctx, path.offset(0, 0, -1.5).x, path.offset(0, 0, -1.5).z, path.yaw(0));
    const ch = [];
    { const id = 'mudrun';
      const g = [gateAt(ctx, path, 0.08, 0, 4, id, 'start'), gateAt(ctx, path, 0.27, 0, 5, id), gateAt(ctx, path, 0.41, 0, 5, id), gateAt(ctx, path, 0.6, 0, 4.5, id, 'finish')];
      ch.push({ id, name: 'Mud Run', desc: 'Power through three mud pits without rolling over.', rules: { noRollover: true }, gates: g }); }
    { const id = 'mudhill';
      const g = [gateAt(ctx, path, 0.645, 0, 4, id, 'start'), gateAt(ctx, path, 0.79, 0, 4, id, 'finish')];
      ch.push({ id, name: 'Hill Climb', desc: 'Climb the greasy mud hill.', rules: { noRollover: true }, gates: g }); }
    return { spawn: spawnFrom(path, 0), path, challenges: ch };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const g = smoothstep(-0.3, 0.3, ctx.n2.noise(x * 0.06, z * 0.06));
    const wetLow = smoothstep(2.0, 0.5, h) * 0.6;
    W(w, [0, 0.35, g, 0, wetLow * 0.4, (1 - g) * 0.6, 0, wetLow]);
  },
  vegetation(ctx) {
    plantTrees(ctx, Math.round(70 * Math.min(1.2, ctx.densityScale + 0.3)), { minH: 26, maxH: 60, clump: 0.05 });
    plantRoots(ctx, 4);
    plantGround(ctx, { bushes: 360, grass: 30000, branches: 50, grassClump: -0.3, grassScale: 1.15 });
  },
};

// ================================================================== 4. DESERT RIDGE
const desertRidge = {
  previewT: 0.31,
  id: 'desert', name: 'Desert Ridge', stars: 2.5, technical: 'Medium', terrain: 'Sand / Rocks', difficulty: 'Medium',
  est: '5–7 min', maxSlope: '30°', bestFor: 'Momentum & lines', biome: 'desert', seed: 44,
  env: { moss: 0.65, topLayer: 3, dust: 1, snow: 1e4, warm: 0.12 },
  backdrop: { edgeHeight: 10, peak: 120, hills: 25, mesa: 90, dunes: 6, trees: 0 },
  backdropSplat: (x, z, h, ny) => [smoothstep(0.85, 0.6, ny), 0.1, 0, 0.9, 0, 0, 0.1, 0],
  trailLayer: 1,
  build(ctx) {
    ctx.rocks.warmBase = 0.12;
    const n = ctx.n;
    const ridgeZ = (x) => 8 + Math.sin(x * 0.05) * 6;
    ctx.fill((x, z) => {
      const dune = Math.pow(1 - Math.abs(Math.sin(x * 0.07 + z * 0.03 + n.noise(x * 0.02, z * 0.02) * 2.2)), 1.8) * 2.2;
      const ridge = Math.exp(-Math.pow((z - ridgeZ(x)) / 9, 2)) * 6.5;
      return dune + ridge + n.fbm(x * 0.03, z * 0.03, 4) * 1.6 + n.fbm(x * 0.2, z * 0.2, 2) * 0.1 + 1;
    });
    ctx.edgeWalls(11, 54, 6);
    const path = ctx.path([[-44, -46], [-31, -37], [-18, -34], [-6, -25], [3, -13], [7, -1], [6, 9], [13, 18], [25, 24], [35, 33], [43, 45]]);
    ctx.carvePath(path, { width: 1.9, fall: 2.8, smooth: 4.5, ruts: 0.05, widthFn: (t, w) => {
      let b = 0; for (const o of [0.15, 0.33, 0.66]) b = Math.max(b, 1 - smoothstep(0.02, 0.055, Math.abs(t - o)));
      return w + b * 2.2;
    } });
    ctx.D = ctx.distanceField(path, 22);
    ctx.obstacle(path, 0.15, 'rocks');
    ctx.obstacle(path, 0.33, 'ledges', { length: 7 });
    ctx.obstacle(path, 0.66, 'boulders', { length: 7 });
    // rocky outcrops (mesa fragments) along the ridge crest
    const rng = ctx.rng;
    for (let c = 0; c < 9; c++) {
      const cx = rng.float(-46, 46), cz = ridgeZ(cx) + rng.float(-5, 5);
      if (ctx.D(cx, cz) < 5) continue;
      for (let r = 0; r < 7; r++) {
        const x = cx + rng.float(-3.5, 3.5), z = cz + rng.float(-3.5, 3.5);
        if (ctx.D(x, z) < 3.5) continue;
        ctx.rocks.add(rng, rng.pick(['block', 'cliff', 'boulder']), x, ctx.hf.baseHeightAt(x, z), z, rng.float(1, 3.2), { sink: 0.3 });
        ctx.noVeg.push({ x, z, r: 3 });
      }
    }
    // gateway rocks framing the trail at the ridge
    for (const sg of [-1, 1]) { const p = path.offset(0.5, sg * 3.4); ctx.rocks.add(rng, 'cliff', p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, 1.9, { sink: 0.3 }); }
    scatterRocks(ctx, 180, { min: 0.12, max: 0.7, trailMax: 0.3 });
    pebbles(ctx, 700);
    heroRock(ctx, path.offset(0, 0, -1.5).x, path.offset(0, 0, -1.5).z, path.yaw(0));
    const ch = [];
    { const id = 'ridge';
      const g = [gateAt(ctx, path, 0.4, 0, 3.6, id, 'start'), gateAt(ctx, path, 0.56, 0, 3.6, id, 'finish')];
      ch.push({ id, name: 'Hill Climb', desc: 'Climb the sandy ridge to the crest.', rules: { noRollover: true }, gates: g }); }
    { const id = 'technical';
      const g = [gateAt(ctx, path, 0.6, 0, 5.5, id, 'start'), gateAt(ctx, path, 0.66 + 0.012, -2.4, 1.6, id), gateAt(ctx, path, 0.73, 0, 3.6, id, 'finish')];
      ch.push({ id, name: 'Technical Line', desc: 'Crawl the hard line through the boulder field.', rules: { noRollover: true }, gates: g }); }
    return { spawn: spawnFrom(path, 0), path, challenges: ch };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const gv = smoothstep(0.2, 0.6, ctx.n2.noise(x * 0.07, z * 0.07));
    W(w, [0, 0.12, 0, 1 - gv * 0.5, 0, 0, gv * 0.6, 0]);
  },
  vegetation(ctx) {
    plantGround(ctx, { bushes: 160, dryBush: true, grass: 5500, dryGrass: true, branches: 25, yucca: 120, grassClump: 0.15 });
  },
};

// ================================================================== 5. CREEK CROSSING
const creekCrossing = {
  previewT: 0.28,
  id: 'creek', name: 'Creek Crossing', stars: 4, technical: 'High', terrain: 'Water / Rocks', difficulty: 'High',
  est: '5–8 min', maxSlope: '34°', bestFor: 'Wet-rock technique', biome: 'creek', seed: 55,
  env: { moss: 0.9, topLayer: 5, dust: 0, snow: 110 },
  backdrop: { edgeHeight: 15, peak: 320, hills: 40, trees: 3, treeLine: 100 },
  backdropSplat: (x, z, h, ny) => [1 - ny + (h > 90 ? 0.4 : 0), 0.1, 0.45, 0, 0, 0.5, 0, 0],
  trailLayer: 1,
  build(ctx) {
    const n = ctx.n;
    const creek = ctx.path([[-72, -4], [-54, -1], [-38, -7], [-22, -6], [-10, -1], [4, 4], [20, 0], [36, 6], [54, 2], [72, 7]], 0.5);
    const DC = ctx.distanceField(creek, 40);
    ctx.DC = DC;
    ctx.fill((x, z) => {
      const d = DC(x, z);
      return 0.35 + smoothstep(2, 30, d) * 5 + d * 0.03 + n.fbm(x * 0.03, z * 0.03, 5) * 2.2 + n.fbm(x * 0.12, z * 0.12, 2) * 0.2;
    });
    ctx.hill(10, -15, 7, 2.6, 1.2);       // boulder pile hill
    ctx.edgeWalls(16, 54, 8);
    // upstream cliff + waterfall at the west edge
    ctx.hill(-60, -1, 9, 7, 0.8);
    const path = ctx.path([[-30, -46], [-27, -33], [-20, -20], [-15, -4], [-9, 10], [1, 21], [15, 25], [27, 16], [30, 3], [27, -12], [34, -27], [44, -40]]);
    ctx.carvePath(path, { width: 1.9, fall: 2.5, smooth: 5, ruts: 0.05 });
    ctx.D = ctx.distanceField(path, 20);
    ctx.creek(creek, { width: 3.6, depth: 0.32, bank: 3.2, waterY: 0.0, flow: [0.35, 0.02] });
    const rng = ctx.rng;
    // rocks in the creek bed and the fords
    for (let i = 0; i <= creek.N; i += 3) {
      const P = creek.pts[i];
      if (Math.abs(P.x) > 56) continue;
      if (rng.chance(0.55)) {
        const lat = rng.float(-3.4, 3.4);
        const x = P.x + lat * -creek.tan[i].z, z = P.z + lat * creek.tan[i].x;
        if (ctx.D(x, z) < 2.4) continue;
        ctx.rocks.add(rng, rng.pick(['boulder', 'slab', 'pebble']), x, ctx.hf.baseHeightAt(x, z), z, rng.float(0.2, 1.1), { sink: 0.4 });
      }
    }
    // ford stepping rocks (technical crossing)
    for (const t of [0.29, 0.75]) {
      for (let s = -3; s <= 3; s++) {
        const p = path.offset(t + s * 0.004, rng.float(-1.1, 1.1));
        ctx.rocks.add(rng, rng.pick(['boulder', 'slab']), p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, rng.float(0.18, 0.42), { sink: 0.45 });
      }
    }
    // boulder pile for rock climb
    for (let i = 0; i < 16; i++) {
      const a = rng.float(0, 6.28), r = rng.float(0, 5.5);
      const x = 10 + Math.cos(a) * r, z = -15 + Math.sin(a) * r;
      ctx.rocks.add(rng, rng.pick(['boulder', 'slab', 'block']), x, ctx.hf.baseHeightAt(x, z), z, rng.float(0.6, 1.3) * (1 - r / 9), { sink: 0.5 });
    }
    // cliff + waterfall
    for (let i = 0; i < 9; i++) { const z = rng.float(-10, 8), x = -56 - rng.float(0, 6); if (Math.abs(z + 1) < 2) continue; ctx.rocks.add(rng, 'cliff', x, ctx.hf.baseHeightAt(x, z), z, rng.float(2.5, 4.5), { sy: 1.8, sink: 0.25 }); }
    ctx.waterfalls.push({ x: -55.2, z: -1.2, y0: 7.6, y1: 0.0, width: 3.2, yaw: Math.PI / 2 });
    scatterRocks(ctx, 140, { min: 0.4, max: 2.0, region: (x, z) => ctx.D(x, z) > 3.5 && DC(x, z) > 3 });
    scatterRocks(ctx, 220, { min: 0.1, max: 0.35, trailMax: 0.5 });
    pebbles(ctx, 700, { region: (x, z) => DC(x, z) < 8 || ctx.D(x, z) < 3 });
    for (let i = 0; i < 6; i++) { const x = rng.float(-45, 45), z = rng.float(-45, 45); if (ctx.D(x, z) > 4 && DC(x, z) > 5) ctx.addLog(x, z, rng.float(4, 8), rng.float(0.25, 0.45), rng.float(0, 6)); }
    heroRock(ctx, path.offset(0, 0, -1.5).x, path.offset(0, 0, -1.5).z, path.yaw(0));
    const ch = [];
    { const id = 'creek';
      const g = [gateAt(ctx, path, 0.22, 0, 3.6, id, 'start'), gateAt(ctx, path, 0.37, 0, 3.6, id, 'finish')];
      ch.push({ id, name: 'Creek Crossing', desc: 'Cross the entire creek without stopping.', rules: { noStop: true }, gates: g }); }
    { const id = 'pile';
      const g0 = gateAt(ctx, path, 0.86, 0, 3.6, id, 'start');
      const top = { x: 10, z: -15, yaw: 0, width: 2.4 }; ctx.markers.push({ type: 'finish', ...top, id });
      ch.push({ id, name: 'Rock Climb', desc: 'Scale the boulder pile beside the trail without rolling over.', rules: { noRollover: true }, gates: [g0, top] }); }
    return { spawn: spawnFrom(path, 0), path, challenges: ch };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const dc = ctx.DC(x, z);
    const gravel = 1 - smoothstep(3, 5.5, dc);
    const mud = (1 - smoothstep(4.5, 6.5, dc)) * smoothstep(3, 4.5, dc);
    const g = smoothstep(-0.2, 0.3, ctx.n2.noise(x * 0.05, z * 0.05));
    W(w, [0, 0.15, g * (1 - gravel), 0, mud * 0.8, (1 - g) * 0.7 * (1 - gravel), gravel * 1.2, 0]);
  },
  vegetation(ctx) {
    plantTrees(ctx, Math.round(170 * Math.min(1.2, ctx.densityScale + 0.3)), { minH: 26, maxH: 66, clump: -0.25, region: (x, z) => ctx.DC(x, z) > 6 });
    plantRoots(ctx, 4);
    plantGround(ctx, { bushes: 300, grass: 24000, branches: 60, grassClump: -0.15, region: (x, z) => ctx.DC(x, z) > 3.6 });
  },
};

// ================================================================== 6. ULTIMATE ROCK COURSE
const ultimate = {
  previewT: 0.58,
  id: 'ultimate', name: 'Ultimate Rock Course', stars: 5, technical: 'Extreme', terrain: 'Mixed Terrain', difficulty: 'Extreme',
  est: '10–15 min', maxSlope: '45°', bestFor: 'Expert crawlers', biome: 'mixed', seed: 66,
  env: { moss: 0.6, topLayer: 5, dust: 0.2, snow: 120, warm: 0.05 },
  backdrop: { edgeHeight: 16, peak: 320, hills: 45, trees: 2, treeLine: 100 },
  backdropSplat: (x, z, h, ny) => [1 - ny + (h > 90 ? 0.4 : 0), 0.15, 0.4, 0, 0, 0.5, 0, 0],
  trailLayer: 1,
  build(ctx) {
    const n = ctx.n;
    const creek = ctx.path([[-72, 2], [-50, 6], [-32, 3], [-18, 2], [-2, 6], [16, 1], [36, 5], [72, 0]], 0.5);
    const DC = ctx.distanceField(creek, 30);
    ctx.DC = DC;
    ctx.fill((x, z) => 0.4 + smoothstep(2, 20, DC(x, z)) * 3.2 + n.fbm(x * 0.03, z * 0.03, 5) * 2.4 + n.ridged(x * 0.05, z * 0.05, 3) * (z > 10 ? 3 : 0.5));
    // big summit and steep slope
    ctx.hill(22, 44, 10, 6.5, 1.0);
    ctx.hill(38, 26, 8, 3.5, 1.4);
    ctx.edgeWalls(16, 54, 9);
    const path = ctx.path([[-46, -46], [-36, -40], [-24, -42], [-12, -34], [-7, -22], [-12, -10], [-19, 2], [-15, 14], [-3, 21], [11, 18], [22, 9], [33, 15], [39, 26], [33, 38], [22, 44]]);
    ctx.carvePath(path, { width: 2.0, fall: 2.4, smooth: 3, ruts: 0.05, widthFn: (t, w) => {
      let b = 0; for (const o of [0.08, 0.6, 0.7]) b = Math.max(b, 1 - smoothstep(0.02, 0.05, Math.abs(t - o)));
      return w + b * 2.2;
    } });
    ctx.D = ctx.distanceField(path, 22);
    ctx.creek(creek, { width: 3.2, depth: 0.28, bank: 3, waterY: 0, flow: [0.35, 0] });
    // mud section
    for (const t of [0.22, 0.27]) { const p = path.offset(t, 0); ctx.mudPit(p.x, p.z, 3, 0.3); }
    const rng = ctx.rng;
    ctx.obstacle(path, 0.08, 'logs');
    ctx.obstacle(path, 0.6, 'ledges', { length: 7 });
    ctx.obstacle(path, 0.7, 'boulders', { length: 7 });
    ctx.crack(path, 0.52, 0.34, 0.55, 0.35);
    ctx.crack(path, 0.78, 0.3, 0.5, -0.45);
    // rock garden canyon section
    for (let i = 0; i < 40; i++) {
      const t = rng.float(0.44, 0.56);
      const p = path.offset(t, rng.float(-1.8, 1.8));
      ctx.rocks.add(rng, rng.pick(['boulder', 'block', 'slab']), p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, rng.float(0.25, 0.7), { sink: 0.45 });
    }
    // walls of the rock section
    for (let i = Math.round(path.N * 0.42); i < path.N * 0.75; i += 6) {
      const P = path.pts[i], T = path.tan[i];
      for (const sg of [-1, 1]) {
        const lat = sg * rng.float(5.5, 8.5);
        const x = P.x - T.z * lat, z = P.z + T.x * lat;
        ctx.rocks.add(rng, rng.pick(['cliff', 'block']), x, ctx.hf.baseHeightAt(x, z), z, rng.float(1.8, 3.6), { sy: rng.float(1, 1.8), sink: 0.25 });
      }
    }
    // final summit stairs
    for (let s = 0; s < 7; s++) {
      const p = path.offset(0.9 + s * 0.013, s % 2 ? 0.6 : -0.6);
      ctx.rocks.add(rng, rng.pick(['slab', 'block']), p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, 0.7 + s * 0.05, { sink: 0.5 });
    }
    // creek ford rocks
    for (let s = -3; s <= 3; s++) { const p = path.offset(0.37 + s * 0.004, rng.float(-1, 1)); ctx.rocks.add(rng, 'boulder', p.x, ctx.hf.baseHeightAt(p.x, p.z), p.z, rng.float(0.2, 0.45), { sink: 0.45 }); }
    scatterRocks(ctx, 200, { min: 0.4, max: 2.2, region: (x, z) => ctx.D(x, z) > 3.5 && DC(x, z) > 3 });
    scatterRocks(ctx, 240, { min: 0.1, max: 0.35, trailMax: 0.5 });
    pebbles(ctx, 800);
    heroRock(ctx, path.offset(0, 0, -1.5).x, path.offset(0, 0, -1.5).z, path.yaw(0));
    const ch = [];
    { const id = 'ultimate';
      const g = [gateAt(ctx, path, 0.03, 0, 4, id, 'start'), gateAt(ctx, path, 0.25, 0, 5, id), gateAt(ctx, path, 0.4, 0, 4, id), gateAt(ctx, path, 0.6, 0, 6.5, id), gateAt(ctx, path, 0.84, 0, 4, id), gateAt(ctx, path, 0.995, 0, 3, id, 'finish')];
      ch.push({ id, name: 'Ultimate Crawl', desc: 'Rocks, mud, water and steep slopes — complete the full course without rolling over.', rules: { noRollover: true }, gates: g }); }
    { const id = 'precision';
      stakesCorridor(ctx, path, 0.12, 0.17, 0.7, 1.0, id);
      const g = [gateAt(ctx, path, 0.115, 0, 1.6, id, 'start'), gateAt(ctx, path, 0.175, 0, 1.6, id, 'finish')];
      ch.push({ id, name: 'Precision Crawl', desc: 'Stay inside the stakes along the narrow trail.', rules: { noTouch: true }, gates: g }); }
    { const id = 'technical';
      const g = [gateAt(ctx, path, 0.56, 0, 6.5, id, 'start'), gateAt(ctx, path, 0.6 + 0.012, -2.4, 1.6, id), gateAt(ctx, path, 0.7 + 0.012, -2.4, 1.6, id), gateAt(ctx, path, 0.75, 0, 4, id, 'finish')];
      ch.push({ id, name: 'Technical Line', desc: 'Black-diamond lines through ledges and boulders.', rules: { noRollover: true }, gates: g }); }
    return { spawn: spawnFrom(path, 0), path, challenges: ch };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const dc = ctx.DC(x, z);
    const gravel = 1 - smoothstep(3, 5, dc);
    const rocky = smoothstep(8, 16, z) * 0.5;
    const g = smoothstep(-0.2, 0.3, ctx.n2.noise(x * 0.05, z * 0.05)) * (1 - rocky);
    W(w, [rocky * 0.4, 0.25 + rocky, g * (1 - gravel), rocky * 0.3, 0, (1 - g) * 0.6 * (1 - gravel) * (1 - rocky), gravel * 1.2, 0]);
  },
  vegetation(ctx) {
    plantTrees(ctx, Math.round(120 * Math.min(1.2, ctx.densityScale + 0.3)), { minH: 24, maxH: 60, clump: -0.2, region: (x, z) => ctx.DC(x, z) > 5 && z < 30 });
    plantRoots(ctx, 3.5);
    plantGround(ctx, { bushes: 260, grass: 18000, branches: 50, grassClump: -0.1, dryGrass: 0.2, region: (x, z) => ctx.DC(x, z) > 3.4 });
  },
};

export const LEVELS = [rockyCanyon, pineForest, mudTrail, desertRidge, creekCrossing, ultimate];
export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));
