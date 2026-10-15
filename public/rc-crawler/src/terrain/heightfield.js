// Heightfield used for both rendering (base ground) and physics (ground + rasterized rocks/logs).
// World is centred on the origin, x/z in [-size/2, size/2].

export const SURF = { DIRT: 0, ROCK: 1, GRASS: 2, SAND: 3, MUD: 4, GRAVEL: 5, WOOD: 6, SNOW: 7 };
export const SURF_NAMES = ['dirt', 'rock', 'grass', 'sand', 'mud', 'gravel', 'wood', 'snow'];

// Per-surface physical properties: grip coefficient, rolling resistance, sinkage
export const SURF_PROPS = [
  { mu: 0.95, roll: 0.05, sink: 0.0, audio: 'dirt' },   // dirt
  { mu: 1.15, roll: 0.02, sink: 0.0, audio: 'rock' },   // rock
  { mu: 0.85, roll: 0.06, sink: 0.0, audio: 'grass' },  // grass
  { mu: 0.62, roll: 0.22, sink: 0.035, audio: 'sand' }, // sand
  { mu: 0.48, roll: 0.30, sink: 0.06, audio: 'mud' },   // mud
  { mu: 0.85, roll: 0.07, sink: 0.01, audio: 'gravel' },// gravel
  { mu: 0.90, roll: 0.03, sink: 0.0, audio: 'rock' },   // wood (logs)
  { mu: 0.5, roll: 0.1, sink: 0.02, audio: 'sand' },    // snow
];

export class Heightfield {
  constructor(size, cell) {
    this.size = size;
    this.cell = cell;
    this.n = Math.round(size / cell);      // cells per side
    this.v = this.n + 1;                    // verts per side
    this.half = size / 2;
    this.base = new Float32Array(this.v * this.v);   // ground only (rendered terrain)
    this.phys = null;                                // ground + solid props (built after rocks)
    this.surf = new Uint8Array(this.v * this.v);
    this.wet = new Uint8Array(this.v * this.v);      // 0..255 extra wetness/mud darkening for shading
    this.waterY = -1e9;
    this.waterMask = null; // optional function(x,z) -> 0..1 where water exists
  }

  idx(i, j) { return j * this.v + i; }
  worldX(i) { return i * this.cell - this.half; }
  worldZ(j) { return j * this.cell - this.half; }

  finalizePhysics() {
    this.phys = new Float32Array(this.base);
  }

  _sample(arr, x, z) {
    const fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    let i = Math.floor(fx), j = Math.floor(fz);
    const n = this.n;
    if (i < 0) i = 0; else if (i > n - 1) i = n - 1;
    if (j < 0) j = 0; else if (j > n - 1) j = n - 1;
    let tx = fx - i, tz = fz - j;
    tx = tx < 0 ? 0 : tx > 1 ? 1 : tx; tz = tz < 0 ? 0 : tz > 1 ? 1 : tz;
    const v = this.v, k = j * v + i;
    const a = arr[k], b = arr[k + 1], c = arr[k + v], d = arr[k + v + 1];
    // triangle interpolation matching render mesh split
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  heightAt(x, z) { return this._sample(this.phys || this.base, x, z); }
  baseHeightAt(x, z) { return this._sample(this.base, x, z); }

  normalAt(x, z, out, phys = true, eps = 0) {
    const e = eps || this.cell;
    const arr = phys && this.phys ? this.phys : this.base;
    const hl = this._sample(arr, x - e, z), hr = this._sample(arr, x + e, z);
    const hd = this._sample(arr, x, z - e), hu = this._sample(arr, x, z + e);
    let nx = hl - hr, ny = 2 * e, nz = hd - hu;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l; out.y = ny / l; out.z = nz / l;
    return out;
  }

  surfaceAt(x, z) {
    const i = Math.round((x + this.half) / this.cell), j = Math.round((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i > this.n || j > this.n) return SURF.ROCK;
    return this.surf[j * this.v + i];
  }

  wetAt(x, z) {
    const i = Math.round((x + this.half) / this.cell), j = Math.round((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i > this.n || j > this.n) return 0;
    return this.wet[j * this.v + i] / 255;
  }

  waterDepthAt(x, z) {
    if (this.waterY < -1e8) return 0;
    if (this.waterMask && this.waterMask(x, z) <= 0) return 0;
    return Math.max(0, this.waterY - this.heightAt(x, z));
  }

  // Rasterize triangles (world-space positions, flat array, non-indexed or indexed) into phys as a max-height.
  rasterize(pos, index, surfType = SURF.ROCK, offset = 0) {
    const phys = this.phys, surf = this.surf, v = this.v, cell = this.cell, half = this.half, n = this.n;
    const triCount = index ? index.length / 3 : pos.length / 9;
    for (let t = 0; t < triCount; t++) {
      let ia, ib, ic;
      if (index) { ia = index[t * 3] * 3; ib = index[t * 3 + 1] * 3; ic = index[t * 3 + 2] * 3; }
      else { ia = t * 9; ib = ia + 3; ic = ia + 6; }
      const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
      const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
      const cx = pos[ic], cy = pos[ic + 1], cz = pos[ic + 2];
      const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
      const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
      let i0 = Math.ceil((minX + half) / cell), i1 = Math.floor((maxX + half) / cell);
      let j0 = Math.ceil((minZ + half) / cell), j1 = Math.floor((maxZ + half) / cell);
      if (i1 < 0 || j1 < 0 || i0 > n || j0 > n) continue;
      if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0; if (i1 > n) i1 = n; if (j1 > n) j1 = n;
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const inv = 1 / d;
      for (let j = j0; j <= j1; j++) {
        const pz = j * cell - half;
        for (let i = i0; i <= i1; i++) {
          const px = i * cell - half;
          const w0 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) * inv;
          const w1 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const h = w0 * ay + w1 * by + w2 * cy - offset;
          const k = j * v + i;
          if (h > phys[k]) { phys[k] = h; if (h > this.base[k] + 0.015) surf[k] = surfType; }
        }
      }
    }
  }

  // Simple box blur of base heights within a radius mask (used after carving)
  smooth(passes = 1) {
    const v = this.v, a = this.base;
    const tmp = new Float32Array(a.length);
    for (let p = 0; p < passes; p++) {
      for (let j = 0; j < v; j++) for (let i = 0; i < v; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(v - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(v - 1, j + 1);
        tmp[j * v + i] = (a[j * v + i] * 4 + a[j * v + i0] + a[j * v + i1] + a[j0 * v + i] + a[j1 * v + i]) / 8;
      }
      a.set(tmp);
    }
  }
}
