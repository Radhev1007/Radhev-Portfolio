// Builds a playable level from a level definition: heightfield synthesis, trail carving, obstacles with
// easy/medium/hard lines, rocks, vegetation, water, backdrop mountains, markers and challenge data.
import * as THREE from 'three';
import { Heightfield, SURF } from '../terrain/heightfield.js';
import { Simplex2, Rng, clamp, smoothstep, lerp } from '../core/noise.js';
import { RockField } from '../terrain/rocks.js';
import { Vegetation } from '../terrain/vegetation.js';
import { createTerrainMaterial, createRockMaterial, sharedTerrainUniforms } from '../terrain/terrainMaterial.js';
import { createWaterMesh, createWaterfall } from '../terrain/water.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------- Path
export class TrailPath {
  constructor(points, spacing = 0.4) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const len = curve.getLength();
    const N = Math.max(8, Math.round(len / spacing));
    this.pts = curve.getSpacedPoints(N);
    this.len = len;
    this.N = N;
    this.tan = this.pts.map((_, i) => {
      const a = this.pts[Math.max(0, i - 1)], b = this.pts[Math.min(N, i + 1)];
      return new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    });
  }
  idx(t) { return clamp(Math.round(t * this.N), 0, this.N); }
  at(t) { return this.pts[this.idx(t)]; }
  tangent(t) { return this.tan[this.idx(t)]; }
  normal(t) { const T = this.tangent(t); return new THREE.Vector3(-T.z, 0, T.x); } // left-hand side
  yaw(t) { const T = this.tangent(t); return Math.atan2(T.x, T.z); }
  offset(t, lateral, along = 0) {
    const P = this.at(t), T = this.tangent(t), N = this.normal(t);
    return { x: P.x + N.x * lateral + T.x * along, z: P.z + N.z * lateral + T.z * along };
  }
}

// ---------------------------------------------------------------- Context
class LevelContext {
  constructor(def, quality) {
    this.def = def;
    this.quality = quality;
    this.size = def.size || 136;
    this.hf = new Heightfield(this.size, 0.1);
    this.rng = new Rng(def.seed || 1);
    this.n = new Simplex2(def.seed || 1);
    this.n2 = new Simplex2((def.seed || 1) + 99);
    this.rocks = new RockField(quality, def.seed || 1);
    // seat every rock on the lowest ground under its footprint so nothing hovers on slopes
    // (any height offset the caller adds above the ground, e.g. stacked ledges, is preserved)
    const addRock = this.rocks.add.bind(this.rocks);
    this.rocks.add = (rng, kind, x, y, z, size, o = {}) => {
      const hf = this.hf, b = hf.baseHeightAt(x, z), r = size * 0.8;
      let m = b;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m = Math.min(m, hf.baseHeightAt(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
      return addRock(rng, kind, x, m + (y - b), z, size, o);
    };
    this.veg = new Vegetation(quality);
    const V = this.hf.v * this.hf.v;
    this.trailW = new Float32Array(V);
    this.mudW = new Float32Array(V);
    this.wetW = new Float32Array(V);
    this.paint = new Float32Array(V);   // extra layer paint (gravel/sand) 0..1
    this.paintLayer = new Uint8Array(V);
    this.noVeg = [];                    // [{x,z,r}] keep-clear circles for vegetation
    this.markers = [];                  // {type,x,z,yaw,color}
    this.water = [];                    // bodies
    this.waterfalls = [];
    this.logsPhys = [];
    this.challenges = [];
    this.trunks = [];
    this.paths = [];
    this.densityScale = { low: 0.35, medium: 0.6, high: 1, ultra: 1.4 }[quality] ?? 1;
  }

  forEachVertex(fn) {
    const hf = this.hf, v = hf.v, cell = hf.cell, half = hf.half;
    for (let j = 0; j < v; j++) { const z = j * cell - half; for (let i = 0; i < v; i++) fn(j * v + i, i * cell - half, z, i, j); }
  }

  // iterate vertices within a radius of (x,z)
  forEachNear(x, z, r, fn) {
    const hf = this.hf, cell = hf.cell, half = hf.half, n = hf.n, v = hf.v;
    const i0 = Math.max(0, Math.floor((x - r + half) / cell)), i1 = Math.min(n, Math.ceil((x + r + half) / cell));
    const j0 = Math.max(0, Math.floor((z - r + half) / cell)), j1 = Math.min(n, Math.ceil((z + r + half) / cell));
    for (let j = j0; j <= j1; j++) { const pz = j * cell - half; for (let i = i0; i <= i1; i++) { const px = i * cell - half; const d = Math.hypot(px - x, pz - z); if (d <= r) fn(j * v + i, px, pz, d); } }
  }

  fill(fn) { const b = this.hf.base; this.forEachVertex((k, x, z) => { b[k] = fn(x, z); }); }

  // edge walls rising around the play area (keeps the crawler in, frames the vistas)
  edgeWalls(height = 14, start = 54, noiseAmp = 6) {
    const b = this.hf.base, n = this.n2, half = this.hf.half;
    this.forEachVertex((k, x, z) => {
      const e = Math.max(Math.abs(x), Math.abs(z)) * 0.7 + Math.hypot(x, z) * 0.3;
      const t = smoothstep(start, half - 2, e + n.noise(x * 0.04, z * 0.04) * 5);
      if (t > 0) b[k] += t * t * (height + n.fbm(x * 0.03, z * 0.03, 4) * noiseAmp);
    });
  }

  hill(x, z, r, h, power = 2) {
    const b = this.hf.base;
    this.forEachNear(x, z, r, (k, px, pz, d) => { const t = 1 - d / r; b[k] += h * (power === 0 ? smoothstep(0, 1, t) : Math.pow(smoothstep(0, 1, t), power)); });
  }

  path(points, spacing) { const p = new TrailPath(points, spacing); this.paths.push(p); return p; }

  // coarse distance-to-path field for large-scale shaping (canyon walls, valleys)
  distanceField(path, maxR = 30, cell = 0.5) {
    const size = this.size, n = Math.round(size / cell) + 1, half = size / 2;
    const D = new Float32Array(n * n).fill(maxR);
    for (const P of path.pts) {
      const i0 = Math.max(0, Math.floor((P.x - maxR + half) / cell)), i1 = Math.min(n - 1, Math.ceil((P.x + maxR + half) / cell));
      const j0 = Math.max(0, Math.floor((P.z - maxR + half) / cell)), j1 = Math.min(n - 1, Math.ceil((P.z + maxR + half) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i * cell - half - P.x, j * cell - half - P.z);
        if (d < D[j * n + i]) D[j * n + i] = d;
      }
    }
    return (x, z) => {
      const fx = clamp((x + half) / cell, 0, n - 1.001), fz = clamp((z + half) / cell, 0, n - 1.001);
      const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * n + i;
      return lerp(lerp(D[k], D[k + 1], tx), lerp(D[k + n], D[k + n + 1], tx), tz);
    };
  }

  // carve a drivable trail following a smoothed height profile; ruts give tyre tracks
  carvePath(path, o = {}) {
    const hf = this.hf, b = hf.base;
    const width = o.width ?? 1.6, fall = o.fall ?? 2.2, win = o.smooth ?? 6, rut = o.ruts ?? 0.05;
    const N = path.N;
    // sampled base profile
    const raw = path.pts.map((P) => hf.baseHeightAt(P.x, P.z));
    const step = path.len / N;
    const wN = Math.max(1, Math.round(win / step));
    const prof = raw.map((_, i) => {
      let s = 0, c = 0;
      for (let k = -wN; k <= wN; k++) { const q = clamp(i + k, 0, N); const w = 1 - Math.abs(k) / (wN + 1); s += raw[q] * w; c += w; }
      return s / c;
    });
    if (o.profile) for (let i = 0; i <= N; i++) prof[i] = o.profile(i / N, prof[i]);
    path.profile = prof;
    const tgt = new Float32Array(b.length);
    const wArr = new Float32Array(b.length);
    for (let i = 0; i <= N; i += 1) {
      const P = path.pts[i], T = path.tan[i];
      const wHere = o.widthFn ? o.widthFn(i / N, width) : width;
      const R = wHere + fall;
      this.forEachNear(P.x, P.z, R, (k, px, pz, d) => {
        const w = 1 - smoothstep(wHere, R, d);
        if (w > wArr[k]) {
          wArr[k] = w;
          const lat = (px - P.x) * -T.z + (pz - P.z) * T.x;
          // twin ruts at the crawler track width + slight crown
          const r1 = Math.exp(-Math.pow((Math.abs(lat) - 0.34) / 0.09, 2));
          tgt[k] = prof[i] - (o.depth ?? 0) - rut * r1 * smoothstep(wHere + 0.3, wHere * 0.4, d) + (o.crown ?? 0) * (1 - Math.min(1, Math.abs(lat) / wHere));
        }
      });
    }
    for (let k = 0; k < b.length; k++) {
      const w = wArr[k];
      if (w > 0) {
        const s = smoothstep(0, 1, w);
        b[k] = lerp(b[k], tgt[k], s);
        if (w > this.trailW[k]) this.trailW[k] = o.paint === false ? this.trailW[k] : w;
      }
    }
    if (o.clearVeg !== false) for (let i = 0; i <= N; i += 4) this.noVeg.push({ x: path.pts[i].x, z: path.pts[i].z, r: width + 1.2 });
  }

  // creek channel: bed below the water level; banks shaped; registers a water body over its bbox
  creek(path, o = {}) {
    const b = this.hf.base, waterY = o.waterY ?? 0, w = o.width ?? 3, depth = o.depth ?? 0.55, bank = o.bank ?? 3;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    const bed = new Float32Array(b.length).fill(1e9);
    const bw = new Float32Array(b.length);
    const R = w + bank * 2.2;
    for (const P of path.pts) {
      minX = Math.min(minX, P.x); maxX = Math.max(maxX, P.x); minZ = Math.min(minZ, P.z); maxZ = Math.max(maxZ, P.z);
      this.forEachNear(P.x, P.z, R, (k, px, pz, d) => {
        let h;
        if (d < w) h = waterY - depth * (1 - Math.pow(d / w, 2)) - 0.05 + this.n.noise(px * 0.8, pz * 0.8) * 0.08;
        else h = waterY + 0.05 + Math.pow((d - w) / bank, 1.3) * 0.6;
        if (h < bed[k]) bed[k] = h;
        // carve fully inside the bank, then ease back into the natural terrain (no wall at the edge)
        const wgt = 1 - smoothstep(w + bank, R, d);
        if (wgt > bw[k]) bw[k] = wgt;
        this.wetW[k] = Math.max(this.wetW[k], 1 - smoothstep(w, w + bank * 0.8, d));
      });
    }
    for (let k = 0; k < b.length; k++) if (bw[k] > 0) b[k] = lerp(b[k], Math.min(b[k], bed[k]), bw[k]);
    const pad = w + bank + 1;
    this.water.push({ x0: minX - pad, x1: maxX + pad, z0: minZ - pad, z1: maxZ + pad, y: waterY, flow: o.flow || [0.3, 0], murky: false, path, width: w });
    for (let i = 0; i <= path.N; i += 3) this.noVeg.push({ x: path.pts[i].x, z: path.pts[i].z, r: w + 0.6 });
    this.creekPath = path;
  }

  mudPit(x, z, r, depth = 0.22, water = true) {
    const b = this.hf.base;
    this.forEachNear(x, z, r * 1.5, (k, px, pz, d) => {
      const nn = this.n.noise(px * 0.5, pz * 0.5) * 0.25;
      const t = 1 - smoothstep(r * 0.4, r * (1.2 + nn), d);
      b[k] -= depth * t * t * (0.85 + this.n.noise(px * 2, pz * 2) * 0.3);
      this.mudW[k] = Math.max(this.mudW[k], smoothstep(0, 0.5, t + nn * 0.5));
      this.wetW[k] = Math.max(this.wetW[k], t);
    });
    if (water) this.pendingPuddles = (this.pendingPuddles || []).concat([{ x, z, r }]);
  }

  paintLayerAt(x, z, r, layer, strength = 1) {
    this.forEachNear(x, z, r, (k, px, pz, d) => {
      const t = (1 - smoothstep(r * 0.5, r, d + this.n.noise(px * 0.7, pz * 0.7) * r * 0.25)) * strength;
      if (t > this.paint[k]) { this.paint[k] = t; this.paintLayer[k] = layer; }
    });
  }

  // ------------------------------------------------ obstacles with three lines
  // lanes: [{lat, diff:'easy'|'medium'|'hard'}]
  obstacle(path, t, kind, o = {}) {
    const rng = this.rng, len = o.length ?? 6;
    const lanes = o.lanes ?? [{ lat: 2.4, diff: 'easy' }, { lat: 0, diff: 'medium' }, { lat: -2.4, diff: 'hard' }];
    const hAt = (x, z) => this.hf.baseHeightAt(x, z);
    for (const lane of lanes) {
      const d = lane.diff;
      const along0 = -len / 2;
      if (kind === 'rocks') {
        const cnt = d === 'easy' ? 6 : d === 'medium' ? 8 : 6;
        for (let r = 0; r < cnt; r++) {
          const al = along0 + (r + 0.5) * (len / cnt) + rng.float(-0.3, 0.3);
          const side = (r % 2 ? 1 : -1) * (d === 'easy' ? rng.float(0.2, 0.7) : rng.float(0.1, 0.5));
          const p = path.offset(t, lane.lat + side, al);
          const size = d === 'easy' ? rng.float(0.16, 0.3) : d === 'medium' ? rng.float(0.3, 0.55) : rng.float(0.55, 0.95);
          this.rocks.add(rng, d === 'hard' ? rng.pick(['boulder', 'block', 'slab']) : rng.pick(['boulder', 'slab', 'pebble']), p.x, hAt(p.x, p.z), p.z, size, { sink: 0.35 });
        }
      } else if (kind === 'ledges') {
        // stepped slabs; hard line = taller, steeper steps
        const steps = d === 'easy' ? 3 : d === 'medium' ? 3 : 4;
        const stepH = d === 'easy' ? 0.14 : d === 'medium' ? 0.24 : 0.36;
        for (let s = 0; s < steps; s++) {
          const al = along0 + 1 + s * (len - 2) / steps;
          const p = path.offset(t, lane.lat, al);
          const size = 0.8 + s * 0.15;
          this.rocks.add(rng, 'flat', p.x, hAt(p.x, p.z) + s * stepH * 0.9, p.z, size, { sx: 1.1, sy: (stepH * (s + 1.4)) / size * 1.1, sz: 0.9, yaw: path.yaw(t) + rng.float(-0.2, 0.2), tilt: 0.04, sink: 0.4 });
        }
      } else if (kind === 'boulders') {
        const cnt = d === 'easy' ? 3 : d === 'medium' ? 4 : 5;
        for (let r = 0; r < cnt; r++) {
          const al = along0 + (r + 0.5) * (len / cnt);
          const side = (r % 2 ? 1 : -1) * rng.float(0.25, 0.6);
          const p = path.offset(t, lane.lat + side, al);
          const size = d === 'easy' ? rng.float(0.3, 0.45) : d === 'medium' ? rng.float(0.5, 0.8) : rng.float(0.85, 1.3);
          this.rocks.add(rng, rng.pick(['boulder', 'block']), p.x, hAt(p.x, p.z), p.z, size, { sink: 0.45 });
        }
      } else if (kind === 'logs') {
        const cnt = d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
        for (let r = 0; r < cnt; r++) {
          const al = along0 + (r + 1) * (len / (cnt + 1));
          const p = path.offset(t, lane.lat, al);
          const rad = d === 'easy' ? 0.12 : d === 'medium' ? 0.2 : 0.3;
          this.addLog(p.x, p.z, rng.float(1.8, 2.6), rad, path.yaw(t) + Math.PI / 2 + rng.float(-0.35, 0.35));
        }
      }
      // lane sign at the entry
      if (lanes.length > 1 && o.signs !== false) {
        const p = path.offset(t, lane.lat + 0.9, along0 - 0.6);
        this.markers.push({ type: 'lane', diff: d, x: p.x, z: p.z, yaw: path.yaw(t) });
      }
    }
  }

  addLog(x, z, length, radius, yaw) {
    const y = Math.min(this.hf.baseHeightAt(x + Math.sin(yaw) * length * 0.4, z + Math.cos(yaw) * length * 0.4), this.hf.baseHeightAt(x - Math.sin(yaw) * length * 0.4, z - Math.cos(yaw) * length * 0.4), this.hf.baseHeightAt(x, z));
    const g = this.veg.makeLog(x, y - radius * 0.35, z, length, radius, yaw - Math.PI / 2);
    this.logsPhys.push(g);
  }

  // rocky crack across the trail (deep groove to test articulation)
  crack(path, t, depth = 0.35, width = 0.5, angle = 0.5) {
    const P = path.at(t), T = path.tangent(t);
    const dir = new THREE.Vector3(T.x, 0, T.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + angle);
    const b = this.hf.base;
    this.forEachNear(P.x, P.z, 4, (k, px, pz, d) => {
      const rx = px - P.x, rz = pz - P.z;
      const across = Math.abs(rx * -dir.z + rz * dir.x);
      const g = 1 - smoothstep(width * 0.3, width, across + this.n.noise(px * 3, pz * 3) * 0.1);
      b[k] -= depth * g * (1 - smoothstep(2.5, 4, d));
    });
  }

  // scatter helper with rejection by predicate
  scatter(count, fn, tries = 4) {
    const rng = this.rng, half = this.hf.half - 1;
    let placed = 0;
    for (let i = 0; i < count * tries && placed < count; i++) {
      const x = rng.float(-half, half), z = rng.float(-half, half);
      if (fn(x, z)) placed++;
    }
  }

  clearAt(x, z) { for (const c of this.noVeg) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false; return true; }

  slopeAt(x, z) { return this.hf.normalAt(x, z, _n, false).y; }

  gate(x, z, yaw, width = 2.2, kind = 'gate') { this.markers.push({ type: kind, x, z, yaw, width }); }
}
const _n = new THREE.Vector3();

// ---------------------------------------------------------------- Build
export async function buildLevel(def, quality, onProgress = () => {}) {
  const ctx = new LevelContext(def, quality);
  onProgress(0.05, 'Shaping terrain');
  await yieldFrame();
  // level-specific terrain + layout
  const layout = def.build(ctx);
  // murky puddles inside mud pits
  for (const pd of ctx.pendingPuddles || []) {
    let mn = 1e9;
    ctx.forEachNear(pd.x, pd.z, pd.r, (k) => { mn = Math.min(mn, ctx.hf.base[k]); });
    ctx.water.push({ x0: pd.x - pd.r * 1.6, x1: pd.x + pd.r * 1.6, z0: pd.z - pd.r * 1.6, z1: pd.z + pd.r * 1.6, y: mn + 0.2, flow: [0.02, 0.01], murky: true, surround: 0x3a3226, cx: pd.x, cz: pd.z, r: pd.r * 1.35,
      // only inside the pit's own mud depression (not neighbouring ditches that happen to be lower)
      mask: (x, z) => {
        const hf = ctx.hf, i = Math.round((x + hf.half) / hf.cell), j = Math.round((z + hf.half) / hf.cell);
        if (i < 0 || j < 0 || i > hf.n || j > hf.n) return false;
        return ctx.mudW[j * hf.v + i] > 0.2 && (x - pd.x) ** 2 + (z - pd.z) ** 2 < (pd.r * 1.35) ** 2;
      } });
  }
  onProgress(0.35, 'Placing rocks');
  await yieldFrame();
  const hf = ctx.hf;

  // surfaces/splat at full res from the level's rule function
  const v = hf.v, V = v * v;
  const splat = new Uint8Array(V * 8);
  const w8 = new Float32Array(8);
  const nn = new THREE.Vector3();
  ctx.forEachVertex((k, x, z, i, j) => {
    const h = hf.base[k];
    hf.normalAt(x, z, nn, false);
    w8.fill(0);
    def.surface(ctx, x, z, h, nn.y, k, w8);
    // trail / mud / wet / paint overlays
    const tw = ctx.trailW[k];
    if (tw > 0) { const t = smoothstep(0.05, 0.6, tw); for (let q = 0; q < 8; q++) w8[q] *= 1 - t * 0.85; w8[def.trailLayer ?? 1] += t; }
    if (ctx.paint[k] > 0) { const t = ctx.paint[k]; for (let q = 0; q < 7; q++) w8[q] *= 1 - t; w8[ctx.paintLayer[k]] += t; }
    const m = ctx.mudW[k];
    if (m > 0) { for (let q = 0; q < 7; q++) w8[q] *= 1 - m; w8[4] += m; }
    w8[7] = Math.max(w8[7], ctx.wetW[k]);
    let s = 0; for (let q = 0; q < 7; q++) s += w8[q];
    s = s || 1;
    let best = 1, bw = -1;
    for (let q = 0; q < 7; q++) { const val = w8[q] / s; splat[k * 8 + q] = val * 255; if (val > bw) { bw = val; best = q; } }
    splat[k * 8 + 7] = clamp(w8[7], 0, 1) * 255;
    // physics surface type
    const layerToSurf = [SURF.ROCK, SURF.DIRT, SURF.GRASS, SURF.SAND, SURF.MUD, SURF.DIRT, SURF.GRAVEL];
    hf.surf[k] = nn.y < 0.7 ? SURF.ROCK : layerToSurf[best];
    hf.wet[k] = clamp(w8[7], 0, 1) * 255;
  });

  // physics heights: ground + rocks + logs + roots
  hf.finalizePhysics();
  ctx.rocks.rasterize(hf);
  for (const g of ctx.logsPhys) hf.rasterize(g.attributes.position.array, g.index ? g.index.array : null, SURF.WOOD, 0.02);
  // water bodies
  hf.waterBodies = ctx.water;
  if (ctx.water.length) {
    hf.waterDepthAt = function (x, z) {
      let d = 0;
      for (const w of this.waterBodies) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 && (!w.mask || w.mask(x, z))) d = Math.max(d, w.y - this.heightAt(x, z));
      return d;
    };
  } else hf.waterDepthAt = () => 0;

  onProgress(0.55, 'Growing vegetation');
  await yieldFrame();
  if (def.vegetation) def.vegetation(ctx);
  for (const g of ctx.veg.roots) hf.rasterize(g.attributes.position.array, g.index ? g.index.array : null, SURF.WOOD, 0.01);

  onProgress(0.7, 'Building meshes');
  await yieldFrame();
  const group = new THREE.Group();
  group.name = 'level';
  const terrainMat = createTerrainMaterial({ quality });
  group.add(buildTerrainMesh(hf, splat, quality, terrainMat));
  const rockMat = createRockMaterial({ quality });
  group.add(ctx.rocks.buildMeshes(rockMat));
  await yieldFrame();
  group.add(ctx.veg.build());
  for (const w of ctx.water) group.add(createWaterMesh(hf, w, quality === 'low' ? 0.5 : 0.25));
  for (const wf of ctx.waterfalls) group.add(createWaterfall(wf.x, wf.y0, wf.y1, wf.z, wf.width, wf.yaw));
  group.add(buildMarkers(ctx));
  onProgress(0.85, 'Raising mountains');
  await yieldFrame();
  const backdrop = buildBackdrop(ctx, terrainMat);
  group.add(backdrop);

  // collision trunks for physics
  const trunks = ctx.veg.trees.map((t) => ({ x: t.x, z: t.z, r: Math.max(0.2, t.s * 0.016 * 1.1) + 0.05, top: t.y + t.s * 0.6 }));

  onProgress(1, 'Ready');
  return {
    def, hf, group, ctx, trunks,
    spawn: layout.spawn, intro: layout.intro || layout.spawn,
    challenges: layout.challenges || [],
    markers: ctx.markers,
    env: def.env || {},
  };
}

// ---------------------------------------------------------------- Terrain mesh (chunked)
function buildTerrainMesh(hf, splat, quality, material) {
  const step = { low: 6, medium: 4, high: 3, ultra: 2 }[quality] ?? 3; // in heightfield cells
  const group = new THREE.Group();
  const verts = Math.floor(hf.n / step);   // cells per side in render grid
  const chunk = 32;                         // render cells per chunk side
  const tmpN = new THREE.Vector3();
  for (let cj = 0; cj < verts; cj += chunk) for (let ci = 0; ci < verts; ci += chunk) {
    const nx = Math.min(chunk, verts - ci), nz = Math.min(chunk, verts - cj);
    const cnt = (nx + 1) * (nz + 1);
    const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), sa = new Float32Array(cnt * 4), sb = new Float32Array(cnt * 4);
    let o = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const gi = (ci + i) * step, gj = (cj + j) * step;
      const k = gj * hf.v + gi;
      const x = hf.worldX(gi), z = hf.worldZ(gj);
      pos[o * 3] = x; pos[o * 3 + 1] = hf.base[k]; pos[o * 3 + 2] = z;
      // sample the slope over the render cell so stair-stepped steep banks don't zig-zag
      hf.normalAt(x, z, tmpN, false, hf.cell * Math.max(2, step));
      nor[o * 3] = tmpN.x; nor[o * 3 + 1] = tmpN.y; nor[o * 3 + 2] = tmpN.z;
      // average splat over the footprint for anti-aliasing
      const acc = [0, 0, 0, 0, 0, 0, 0, 0]; let c = 0;
      const r = Math.floor(step / 2);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const ii = clamp(gi + di, 0, hf.n), jj = clamp(gj + dj, 0, hf.n);
        const kk = (jj * hf.v + ii) * 8;
        for (let q = 0; q < 8; q++) acc[q] += splat[kk + q];
        c++;
      }
      for (let q = 0; q < 4; q++) { sa[o * 4 + q] = acc[q] / c / 255; sb[o * 4 + q] = acc[q + 4] / c / 255; }
      o++;
    }
    const idx = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aSplatA', new THREE.BufferAttribute(sa, 4));
    g.setAttribute('aSplatB', new THREE.BufferAttribute(sb, 4));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true; m.castShadow = true;
    group.add(m);
  }
  return group;
}

// ---------------------------------------------------------------- Backdrop mountains
function buildBackdrop(ctx, terrainMat) {
  const def = ctx.def, n = new Simplex2((def.seed || 1) + 7), half = ctx.hf.half;
  const bd = def.backdrop || {};
  const rings = 96, segs = 288;
  const pos = [], nor = [], sa = [], sb = [], idx = [];
  const r0 = half * 0.92, r1 = 1400;
  const edgeH = bd.edgeHeight ?? 12;
  const heightAt = (x, z) => {
    const r = Math.hypot(x, z);
    const t = smoothstep(r0, r0 + 140, r);
    // broad massifs: warped low-frequency ridges with smaller ridges layered on their flanks
    const wx = n.fbm(x * 0.0012 + 11, z * 0.0012, 3) * 260, wz = n.fbm(x * 0.0012, z * 0.0012 + 7, 3) * 260;
    const ridge = n.ridged((x + wx) * 0.0016, (z + wz) * 0.0016, 6);
    const sub = n.ridged(x * 0.0055 + 3, z * 0.0055, 4);
    const mtn = (Math.pow(ridge, 1.15) * 0.8 + sub * ridge * 0.28) * (bd.peak ?? 260) * smoothstep(120, 560, r);
    const hills = (n.fbm(x * 0.012, z * 0.012, 4) * 0.5 + 0.5) * (bd.hills ?? 30);
    let h = lerp(edgeH - 4, edgeH + hills, t) + mtn;
    if (bd.mesa) { const m = n.fbm(x * 0.006 + 9, z * 0.006, 3); h += smoothstep(0.05, 0.12, m) * bd.mesa * smoothstep(100, 250, r); }
    if (bd.dunes) h += Math.sin(x * 0.03 + n.noise(x * 0.004, z * 0.004) * 4) * bd.dunes * t;
    return h;
  };
  for (let j = 0; j <= rings; j++) {
    const rr = r0 + (r1 - r0) * Math.pow(j / rings, 2.2);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const h = heightAt(x, z);
      pos.push(x, h, z);
      const e = 2 + rr * 0.01;
      const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
      const nv = new THREE.Vector3(-hx, 2 * e, -hz).normalize();
      nor.push(nv.x, nv.y, nv.z);
      const w = def.backdropSplat ? def.backdropSplat(x, z, h, nv.y) : [0.3, 0.2, 0.5, 0, 0, 0, 0, 0];
      sa.push(w[0], w[1], w[2], w[3]); sb.push(w[4], w[5], w[6], w[7]);
      // far trees on gentle forested slopes
      if (bd.trees && rr > 115 && j < rings * 0.5 && i % 1 === 0 && nv.y > 0.8 && h < (bd.treeLine ?? 120)) {
        const cnt = Math.round(bd.trees * (1 - j / rings));
        for (let c = 0; c < cnt; c++) {
          const aa = a + (ctx.rng.next() - 0.5) * (Math.PI * 2 / segs);
          const r2 = rr + ctx.rng.float(-8, 8);
          const tx = Math.cos(aa) * r2, tz = Math.sin(aa) * r2;
          if (n.noise(tx * 0.01, tz * 0.01) > -0.2) ctx.veg.addFarTree(tx, heightAt(tx, tz) - 0.5, tz, ctx.rng.float(18, 34) * (1 + rr / 600));
        }
      }
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
    const a = j * (segs + 1) + i, b = a + 1, c = a + segs + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aSplatA', new THREE.Float32BufferAttribute(sa, 4));
  g.setAttribute('aSplatB', new THREE.Float32BufferAttribute(sb, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, terrainMat);
  m.receiveShadow = true;
  const grp = new THREE.Group();
  grp.add(m);
  // far trees were added to veg after veg.build(); build a dedicated group for them
  if (ctx.veg.farTrees.length) {
    const vv = new Vegetation(ctx.quality);
    vv.farTrees = ctx.veg.farTrees;
    grp.add(vv.build());
  }
  return grp;
}

// ---------------------------------------------------------------- Markers (lane signs, gates, stakes)
function buildMarkers(ctx) {
  const group = new THREE.Group();
  const hf = ctx.hf;
  const postGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 6); postGeo.translate(0, 0.45, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.6, metalness: 0.4 });
  const signGeo = new THREE.BoxGeometry(0.22, 0.22, 0.02);
  const colors = { easy: 0x2f8f4a, medium: 0x2a5fb0, hard: 0x111111 };
  const flagGeo = new THREE.PlaneGeometry(0.3, 0.2); flagGeo.translate(0.15, 0, 0);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xf0a020, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x402000 });
  const stakeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5); stakeGeo.translate(0, 0.3, 0);
  const stakeMat = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.6 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xc8352a, roughness: 0.6 });
  const tapeGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.1, 5); tapeGeo.translate(0, 0.48, 0);
  for (const m of ctx.markers) {
    const y = hf.heightAt(m.x, m.z) - 0.05;
    if (m.type === 'lane') {
      const g = new THREE.Group();
      const p = new THREE.Mesh(postGeo, postMat); p.castShadow = true; g.add(p);
      const s = new THREE.Mesh(signGeo, new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.5 }));
      s.position.y = 0.82; s.castShadow = true; g.add(s);
      const symGeo = m.diff === 'easy' ? new THREE.CircleGeometry(0.075, 16) : m.diff === 'medium' ? new THREE.PlaneGeometry(0.13, 0.13) : new THREE.PlaneGeometry(0.11, 0.11);
      const sym = new THREE.Mesh(symGeo, new THREE.MeshStandardMaterial({ color: colors[m.diff], roughness: 0.5 }));
      sym.position.set(0, 0.82, 0.012); if (m.diff === 'hard') sym.rotation.z = Math.PI / 4;
      const sym2 = sym.clone(); sym2.position.z = -0.012; sym2.rotation.y = Math.PI;
      g.add(sym, sym2);
      g.position.set(m.x, y, m.z); g.rotation.y = m.yaw;
      group.add(g);
    } else if (m.type === 'gate' || m.type === 'finish' || m.type === 'start') {
      for (const sgn of [-1, 1]) {
        const g = new THREE.Group();
        const p = new THREE.Mesh(postGeo, postMat); p.scale.y = 1.4; p.castShadow = true; g.add(p);
        const f = new THREE.Mesh(flagGeo, m.type === 'finish' ? new THREE.MeshStandardMaterial({ color: 0xeeeeee, side: THREE.DoubleSide }) : flagMat);
        f.position.y = 1.15; f.userData.flag = true; g.add(f);
        const px = m.x + Math.cos(m.yaw) * sgn * m.width / 2, pz = m.z - Math.sin(m.yaw) * sgn * m.width / 2;
        g.position.set(px, hf.heightAt(px, pz) - 0.05, pz);
        g.rotation.y = m.yaw + Math.PI / 2;
        g.userData.markerId = m.id;
        group.add(g);
      }
    } else if (m.type === 'stake') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(stakeGeo, stakeMat), new THREE.Mesh(tapeGeo, tapeMat));
      g.children.forEach((c) => (c.castShadow = true));
      g.position.set(m.x, y, m.z);
      group.add(g);
    }
  }
  return group;
}

export { sharedTerrainUniforms };
