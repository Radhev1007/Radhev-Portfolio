// Trailhead Valley: the open world's hub. A grassy bowl with a basecamp in the middle, a ring trail round it
// (the hub's own activities hang off that), and six trails out to six gateways at the rim, one per terrain.
// Each trail takes on its destination's ground as it nears the rim, so you can see where it leads.
//
// The layout returns, beside the usual spawn / path / challenges:
//   gateways: [{ id, to, x, z, yaw, width }]   yaw points outward (the way you drive to leave)
//   arrivals: { [levelId]: { x, z, yaw } }       where you land coming back from that terrain, facing basecamp
//   basecamp: { x, z, r, tent, flag, board }     props are built by the world code (world/gateways.js)
import { smoothstep, lerp } from '../core/noise.js';
import { plantTrees, plantGround, scatterRocks, pebbles } from './scatter.js';

const SPOKES = ['desert', 'forest', 'mud', 'canyon', 'creek', 'ultimate'];   // bearings 0, 60, ... 300 deg
const GATE_R = 70, ARRIVE_R = 64, CAMP_R = 9, RING_R = 18;
const W = (w, a) => { for (let i = 0; i < a.length; i++) w[i] = a[i]; };

// splat layers: 0 rock 1 dirt 2 grass 3 sand 4 mud 5 forest 6 gravel 7 wet
const THEME = {
  desert: { layer: 3 },
  forest: { layer: 5 },
  mud: { layer: 4, mud: true },
  canyon: { layer: 0, rocks: [0.5, 1.4] },
  creek: { layer: 7, second: 6 },
  ultimate: { layer: 6, rocks: [0.4, 1.1] },
};

export const hub = {
  previewT: 0.05,
  id: 'hub', name: 'Trailhead Valley', stars: 1, technical: 'Easy', terrain: 'Grass / Trails', difficulty: 'Easy',
  est: 'Open', maxSlope: '20°', bestFor: 'Exploring', biome: 'forest', seed: 7, size: 160,
  env: { moss: 0.7, topLayer: 2, dust: 0.1, snow: 1e4 },
  backdrop: { edgeHeight: 14, peak: 260, hills: 40, trees: 3, treeLine: 120 },
  backdropSplat: (x, z, h, ny) => [1 - ny + (h > 100 ? 0.5 : 0), 0.15, 0.6, 0, 0, 0.4, 0, 0],
  trailLayer: 1,
  build(ctx) {
    const n = ctx.n, hf = ctx.hf;
    // a shallow bowl: rises gently toward the rim, rolling ground between the trails
    ctx.fill((x, z) => {
      const r = Math.hypot(x, z);
      return n.fbm(x * 0.02, z * 0.02, 5) * 3 + n.fbm(x * 0.08, z * 0.08, 3) * 0.45 + smoothstep(10, 75, r) * 4;
    });
    ctx.edgeWalls(14, 74, 7);
    // basecamp: levelled to its centre height, easing out over 3 m (again after the trails, which cut into it)
    const campY = hf.baseHeightAt(0, 0);
    const levelCamp = () => ctx.forEachNear(0, 0, CAMP_R + 3, (k, px, pz, d) => { hf.base[k] = lerp(campY, hf.base[k], smoothstep(CAMP_R, CAMP_R + 3, d)); });
    levelCamp();
    ctx.noVeg.push({ x: 0, z: 0, r: CAMP_R + 3 });

    const gateways = [], arrivals = {};
    SPOKES.forEach((to, i) => {
      const b = (i * Math.PI) / 3, ux = Math.sin(b), uz = Math.cos(b), px = uz, pz = -ux;   // p: across the spoke
      const pts = [];
      for (let r = CAMP_R - 1; r <= GATE_R + 2.01; r += 5) {
        // a gentle wander, tapered to nothing at both ends so the trail leaves basecamp and meets its gateway straight
        const wig = n.noise(r * 0.05, i * 7.3) * 3.5 * smoothstep(CAMP_R + 2, CAMP_R + 12, r) * (1 - smoothstep(GATE_R - 20, GATE_R - 6, r));
        pts.push([ux * r + px * wig, uz * r + pz * wig]);
      }
      const spoke = ctx.path(pts);
      ctx.carvePath(spoke, { width: 1.8, fall: 2.4, smooth: 8, ruts: 0.05 });
      const gx = ux * GATE_R, gz = uz * GATE_R;
      // gateway pad: levelled to the trail there, 2.5 m round, easing back into the trail over 4.5 m
      const padY = hf.baseHeightAt(gx, gz);
      ctx.forEachNear(gx, gz, 7, (k, qx, qz, d) => { hf.base[k] = lerp(padY, hf.base[k], smoothstep(2.5, 7, d)); });
      ctx.noVeg.push({ x: gx, z: gz, r: 5 });
      gateways.push({ id: to, to, x: gx, z: gz, yaw: b, width: 3.2 });
      arrivals[to] = { x: ux * ARRIVE_R, z: uz * ARRIVE_R, yaw: b + Math.PI };
      // the destination's ground over the outer stretch of the trail
      const th = THEME[to];
      for (let r = 44; r <= GATE_R - 2; r += 3) {
        const q = spoke.offset(Math.min(1, (r - (CAMP_R - 1)) / (GATE_R + 3 - CAMP_R)), 0);
        ctx.paintLayerAt(q.x, q.z, 3 + (r - 44) * 0.12, th.layer, smoothstep(44, 60, r));
        if (th.second) ctx.paintLayerAt(q.x + px * 3, q.z + pz * 3, 2.5, th.second, 0.8);
      }
      if (th.mud) for (const r of [50, 57]) { const q = { x: ux * r + px * 4.6, z: uz * r + pz * 4.6 }; ctx.mudPit(q.x, q.z, 1.5, 0.16); }
      if (th.rocks) scatterRocks(ctx, 40, { min: th.rocks[0], max: th.rocks[1], region: (x, z) => { const a = x * ux + z * uz, c = Math.abs(x * px + z * pz); return a > 46 && a < GATE_R - 3 && c > 3.5 && c < 12; } });
    });

    // the ring trail round basecamp: the hub's activities hang off it
    const ring = [];
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2 + 0.26; ring.push([Math.sin(a) * RING_R, Math.cos(a) * RING_R]); }
    const path = ctx.path(ring);
    ctx.carvePath(path, { width: 1.7, fall: 2.2, smooth: 6, ruts: 0.05 });
    // where each spoke crosses the ring the two trails were carved to slightly different heights: blend each
    // crossing into a small level junction
    for (let i = 0; i < SPOKES.length; i++) {
      const sp = ctx.paths[i];
      const j = sp.pts.reduce((best, q) => (Math.abs(Math.hypot(q.x, q.z) - RING_R) < Math.abs(Math.hypot(best.x, best.z) - RING_R) ? q : best));
      const jy = hf.baseHeightAt(j.x, j.z);
      ctx.forEachNear(j.x, j.z, 7, (k, qx, qz, d) => { hf.base[k] = lerp(jy, hf.base[k], smoothstep(2, 7, d)); });
    }
    levelCamp();

    scatterRocks(ctx, 90, { min: 0.3, max: 1.4, region: (x, z) => Math.hypot(x, z) > 24 });
    pebbles(ctx, 400, { region: (x, z) => Math.hypot(x, z) < 60 });

    return {
      spawn: { x: 0, z: 2, yaw: 0 },
      path,
      challenges: [],
      gateways,
      arrivals,
      keepClear: [{ x: 0, z: 0, r: CAMP_R + 3 }, ...gateways.map((g) => ({ x: g.x, z: g.z, r: 7 }))],
      basecamp: { x: 0, z: 0, r: CAMP_R, tent: { x: -5, z: -4 }, flag: { x: 5, z: -4 }, board: { x: -6, z: 3, yaw: Math.atan2(6, -1) } },
    };
  },
  surface(ctx, x, z, h, ny, k, w) {
    const g = smoothstep(-0.2, 0.4, ctx.n2.noise(x * 0.05, z * 0.05));
    W(w, [smoothstep(0.85, 0.6, ny), 0.12 + (1 - g) * 0.3, 0.5 + g * 0.5, 0, 0, 0.25 * (1 - g), 0, 0]);
  },
  vegetation(ctx) {
    plantTrees(ctx, Math.round(150 * Math.min(1.2, ctx.densityScale + 0.3)), { minH: 24, maxH: 60, clump: -0.2 });
    plantGround(ctx, { bushes: 260, grass: 18000, branches: 50, grassClump: 0.05 });
  },
};
