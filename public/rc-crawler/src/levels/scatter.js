// Shared terrain-dressing helpers (trees, ground cover, rocks, pebbles and the tests they place by), used by
// every level definition: levels.js and the hub (hub.js).
import * as THREE from 'three';
import { smoothstep, clamp, lerp } from '../core/noise.js';

export function vIdx(ctx, x, z) {
  const hf = ctx.hf;
  const i = clamp(Math.round((x + hf.half) / hf.cell), 0, hf.n), j = clamp(Math.round((z + hf.half) / hf.cell), 0, hf.n);
  return j * hf.v + i;
}

export function nearTrail(ctx, x, z, r) {
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (ctx.trailW[vIdx(ctx, x + dx, z + dz)] > 0.02) return true;
  return false;
}

export function onRock(ctx, x, z) { return ctx.hf.heightAt(x, z) - ctx.hf.baseHeightAt(x, z) > 0.04; }
export function inWater(ctx, x, z) { return ctx.hf.waterDepthAt(x, z) > -0.05 && ctx.hf.waterBodies?.some((w) => x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && ctx.hf.baseHeightAt(x, z) < w.y + 0.08); }

export function plantTrees(ctx, count, o = {}) {
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

export function plantGround(ctx, o) {
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
export function plantRoots(ctx, maxDist = 6) {
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

export function scatterRocks(ctx, n, o = {}) {
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
export function pebbles(ctx, n, o = {}) {
  scatterRocks(ctx, n * ctx.densityScale, { min: 0.04, max: 0.12, kinds: ['pebble'], onTrail: true, sink: 0.4, ...o });
}

