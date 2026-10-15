// Procedural, tileable PBR-ish texture layers generated on the CPU and packed into texture arrays.
// Layer order (shared by terrain + rock shaders):
//   0 rock, 1 dirt, 2 grass, 3 sand, 4 mud, 5 forest floor (needles/moss), 6 gravel
// albedo array: RGB = albedo, A = roughness
// normal array: RG = tangent normal xy, B = height (for blending / AO), A = 255
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';

export const LAYERS = { ROCK: 0, DIRT: 1, GRASS: 2, SAND: 3, MUD: 4, FOREST: 5, GRAVEL: 6 };
const LAYER_COUNT = 7;

class PeriodicNoise {
  constructor(seed) {
    this.rnd = mulberry32(seed);
    this.tab = new Float32Array(4096);
    for (let i = 0; i < 4096; i++) this.tab[i] = this.rnd();
  }
  hash(i, j, s) { return this.tab[((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) & 4095]; }
  // value noise with integer period p (in lattice cells), x,y in [0,1)
  value(x, y, p, s = 0) {
    const fx = x * p, fy = y * p;
    const i = Math.floor(fx), j = Math.floor(fy);
    let tx = fx - i, ty = fy - j;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const i0 = ((i % p) + p) % p, j0 = ((j % p) + p) % p, i1 = (i0 + 1) % p, j1 = (j0 + 1) % p;
    const a = this.hash(i0, j0, s), b = this.hash(i1, j0, s), c = this.hash(i0, j1, s), d = this.hash(i1, j1, s);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  fbm(x, y, p, oct = 5, gain = 0.5, s = 0) {
    let a = 1, sum = 0, n = 0;
    for (let o = 0; o < oct; o++) { sum += a * this.value(x, y, p, s + o); n += a; a *= gain; p *= 2; }
    return sum / n;
  }
  // periodic worley: returns [F1, F2] distances in cell units
  worley(x, y, p, s = 0) {
    const fx = x * p, fy = y * p;
    const i = Math.floor(fx), j = Math.floor(fy);
    let f1 = 9, f2 = 9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = i + di, cj = j + dj;
      const wi = ((ci % p) + p) % p, wj = ((cj % p) + p) % p;
      const px = ci + this.hash(wi, wj, s + 11), py = cj + this.hash(wi, wj, s + 23);
      const d = Math.hypot(px - fx, py - fy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return [f1, f2];
  }
}

const mix = (a, b, t) => a + (b - a) * t;
const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function genLayer(kind, S, nz) {
  const H = new Float32Array(S * S);
  const C = new Float32Array(S * S * 3);
  const R = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, k = y * S + x;
    let h = 0, r = 0, g = 0, b = 0, rough = 0.8;
    if (kind === LAYERS.ROCK) {
      // weathered stone: warped multi-scale grain, mineral speckle, a few meandering hairline fractures,
      // faint veins and pitting. No cellular pattern (that reads as paving).
      const wx = nz.fbm(u, v, 3, 3, 0.5, 21) - 0.5, wy = nz.fbm(u, v, 3, 3, 0.5, 22) - 0.5;
      const big = nz.fbm(u + wx * 0.3, v + wy * 0.3, 3, 5, 0.55, 3);
      const mid = nz.fbm(u + wx * 0.1, v + wy * 0.1, 10, 4, 0.5, 5);
      const fine = nz.fbm(u, v, 40, 3, 0.5, 9);
      const grain = nz.value(u, v, 256, 77), grain2 = nz.value(u, v, 128, 78);
      const ridge = (q) => 1 - Math.abs(q - 0.5) * 2;
      const c1 = Math.pow(ridge(nz.fbm(u + wx * 0.2, v + wy * 0.2, 3, 4, 0.5, 61)), 80) * (nz.value(u, v, 2, 65) > 0.35 ? 1 : 0.2);
      const c2 = Math.pow(ridge(nz.fbm(u, v, 8, 3, 0.5, 62)), 110) * (nz.value(u, v, 3, 63) > 0.6 ? 1 : 0);
      const crack = Math.min(1, c1 + c2 * 0.8);
      const vein = Math.pow(ridge(nz.fbm(u, v, 2, 3, 0.5, 64)), 90);
      const pit = grain > 0.965 ? (grain - 0.965) * 28 : 0;
      h = 0.42 * big + 0.3 * mid + 0.16 * fine + 0.06 * grain - 0.25 * crack - 0.2 * pit + 0.04 * vein;
      const tint = nz.fbm(u, v, 2, 3, 0.5, 40);
      const base = 0.34 + 0.24 * big + 0.12 * mid + 0.07 * fine;
      r = base * mix(0.97, 1.08, tint); g = base * mix(0.93, 0.98, tint); b = base * mix(0.86, 0.9, tint);
      // mineral speckle: light quartz/feldspar, dark mica
      if (grain > 0.86) { const k2 = (grain - 0.86) * 2.2; r += k2 * 0.22; g += k2 * 0.21; b += k2 * 0.19; }
      if (grain2 < 0.1) { const k2 = (0.1 - grain2) * 4; r *= 1 - k2 * 0.45; g *= 1 - k2 * 0.45; b *= 1 - k2 * 0.42; }
      // fractures are dark, veins pale
      const dk = 1 - crack * 0.35 - pit * 0.3; r *= dk; g *= dk; b *= dk;
      r = mix(r, 0.72, vein * 0.5); g = mix(g, 0.7, vein * 0.5); b = mix(b, 0.66, vein * 0.5);
      const lich = sat((nz.fbm(u, v, 6, 3, 0.5, 44) - 0.64) * 7) * 0.45;
      r = mix(r, 0.6, lich * 0.45); g = mix(g, 0.6, lich * 0.45); b = mix(b, 0.5, lich * 0.45);
      rough = 0.8 + 0.1 * fine - 0.06 * big + crack * 0.08;
    } else if (kind === LAYERS.DIRT) {
      const f = nz.fbm(u, v, 5, 5, 0.55, 2);
      const fine = nz.fbm(u, v, 48, 2, 0.5, 5);
      const w = nz.worley(u, v, 9, 7);
      const pebble = sat(1 - w[0] * 3.2) * (nz.value(u, v, 9, 8) > 0.55 ? 1 : 0);
      h = 0.45 * f + 0.2 * fine + 0.35 * pebble * pebble;
      const base = 0.30 + 0.18 * f + 0.08 * fine;
      r = base * 1.08; g = base * 0.86; b = base * 0.66;
      if (pebble > 0.25) { const t = sat((pebble - 0.25) * 1.2) * 0.7; const pc = 0.36 + 0.14 * nz.hash(Math.floor(u * 9), Math.floor(v * 9), 3); r = mix(r, pc, t); g = mix(g, pc * 0.95, t); b = mix(b, pc * 0.88, t); }
      rough = 0.88;
    } else if (kind === LAYERS.GRASS) {
      const f = nz.fbm(u, v, 6, 5, 0.6, 4);
      const blades = nz.fbm(u * 1.0, v * 0.25, 64, 3, 0.6, 12);
      const dry = nz.fbm(u, v, 3, 3, 0.5, 15);
      h = 0.5 * blades + 0.3 * f;
      const base = 0.18 + 0.2 * blades + 0.08 * f;
      r = base * mix(0.78, 1.08, dry); g = base * mix(0.98, 0.94, dry); b = base * mix(0.34, 0.45, dry);
      rough = 0.9;
    } else if (kind === LAYERS.SAND) {
      const f = nz.fbm(u, v, 4, 4, 0.5, 6);
      const grain = nz.value(u, v, 256, 8) * 0.5 + nz.value(u, v, 128, 9) * 0.5;
      const rip = (0.5 + 0.5 * Math.sin((v * 6 + f * 3.5 + nz.fbm(u, v, 2, 2, 0.5, 7) * 2) * Math.PI * 2)) * (0.3 + 0.7 * nz.fbm(u, v, 3, 2, 0.5, 33));
      h = 0.18 * rip + 0.35 * f + 0.3 * grain;
      const base = 0.6 + 0.14 * f + 0.07 * grain - 0.02 * rip;
      r = base * 1.0; g = base * 0.84; b = base * 0.64;
      rough = 0.95;
    } else if (kind === LAYERS.MUD) {
      const f = nz.fbm(u, v, 4, 5, 0.55, 30);
      const fine = nz.fbm(u, v, 40, 2, 0.5, 31);
      const puddle = sat((f - 0.52) * 6);
      h = 0.6 * f + 0.1 * fine - 0.3 * puddle;
      const base = 0.17 + 0.1 * f + 0.04 * fine;
      r = base * 1.05; g = base * 0.82; b = base * 0.62;
      r *= 1 - puddle * 0.35; g *= 1 - puddle * 0.33; b *= 1 - puddle * 0.25;
      rough = mix(0.62, 0.32, puddle);
    } else if (kind === LAYERS.FOREST) {
      // needle litter + moss patches
      const f = nz.fbm(u, v, 5, 5, 0.55, 50);
      const moss = sat((nz.fbm(u, v, 4, 4, 0.5, 51) - 0.45) * 4);
      let needles = 0;
      for (let s = 0; s < 3; s++) {
        const a = nz.hash(Math.floor(u * 24), Math.floor(v * 24), 60 + s) * Math.PI;
        const lu = u * Math.cos(a) * 90 + v * Math.sin(a) * 90;
        const lv = -u * Math.sin(a) * 18 + v * Math.cos(a) * 18;
        needles = Math.max(needles, sat(1 - Math.abs(Math.sin(lv * Math.PI * 2 + nz.value(u, v, 32, 70 + s) * 6)) * 3) * nz.value(u, v, 64, 80 + s));
      }
      h = 0.4 * f + 0.4 * needles + 0.2 * moss;
      const base = 0.2 + 0.12 * f;
      r = base * 1.1 + needles * 0.18; g = base * 0.85 + needles * 0.1; b = base * 0.6 + needles * 0.04;
      r = mix(r, 0.16, moss * 0.8); g = mix(g, 0.24, moss * 0.8); b = mix(b, 0.08, moss * 0.8);
      rough = 0.9;
    } else if (kind === LAYERS.GRAVEL) {
      const w = nz.worley(u, v, 40, 90);
      const stone = sat(1 - w[0] * 1.6);
      const id = nz.value(u, v, 40, 91);
      const f = nz.fbm(u, v, 6, 3, 0.5, 92);
      h = stone * 0.8 + f * 0.2;
      const c = 0.32 + 0.3 * id;
      r = mix(0.36, c * 1.08, stone); g = mix(0.31, c * 1.0, stone); b = mix(0.25, c * 0.9, stone);
      rough = 0.85;
    }
    H[k] = h; C[k * 3] = r; C[k * 3 + 1] = g; C[k * 3 + 2] = b; R[k] = rough;
  }
  return { H, C, R };
}

let cached = null;

export function getTerrainTextures(quality = 'high') {
  if (cached && cached.quality === quality) return cached;
  const S = quality === 'low' ? 256 : quality === 'medium' ? 512 : 512;
  const alb = new Uint8Array(S * S * 4 * LAYER_COUNT);
  const nor = new Uint8Array(S * S * 4 * LAYER_COUNT);
  const strength = [5.0, 3.5, 2.5, 1.0, 1.0, 3.0, 5.0];
  for (let L = 0; L < LAYER_COUNT; L++) {
    const nz = new PeriodicNoise(1000 + L * 17);
    const { H, C, R } = genLayer(L, S, nz);
    const off = S * S * 4 * L;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x, o = off + k * 4;
      alb[o] = Math.min(255, Math.pow(C[k * 3], 1.0) * 255);
      alb[o + 1] = Math.min(255, C[k * 3 + 1] * 255);
      alb[o + 2] = Math.min(255, C[k * 3 + 2] * 255);
      alb[o + 3] = Math.min(255, R[k] * 255);
      const hl = H[y * S + ((x - 1 + S) % S)], hr = H[y * S + ((x + 1) % S)];
      const hd = H[((y - 1 + S) % S) * S + x], hu = H[((y + 1) % S) * S + x];
      let nx = (hl - hr) * strength[L], ny = (hd - hu) * strength[L], nzv = 1 / S * 64;
      const l = Math.hypot(nx, ny, nzv);
      nor[o] = (nx / l * 0.5 + 0.5) * 255;
      nor[o + 1] = (ny / l * 0.5 + 0.5) * 255;
      nor[o + 2] = Math.min(255, Math.max(0, H[k] * 255));
      nor[o + 3] = 255;
    }
  }
  const mk = (data, srgb) => {
    const t = new THREE.DataArrayTexture(data, S, S, LAYER_COUNT);
    t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  cached = { quality, albedo: mk(alb, true), normal: mk(nor, false), size: S };
  return cached;
}

// Bark texture for trunks/logs (canvas, tileable vertically)
export function makeBarkTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const nz = new PeriodicNoise(77);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const ridge = Math.abs(Math.sin((u * 9 + nz.fbm(u, v, 4, 4, 0.5, 1) * 1.5) * Math.PI));
    const f = nz.fbm(u, v, 8, 4, 0.55, 2);
    const plates = Math.pow(ridge, 0.6) * (0.6 + 0.4 * f);
    const base = 0.12 + 0.28 * plates;
    const o = (y * S + x) * 4;
    img.data[o] = base * 255 * 1.0; img.data[o + 1] = base * 255 * 0.86; img.data[o + 2] = base * 255 * 0.74; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
