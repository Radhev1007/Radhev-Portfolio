/**
 * The crawler park's ground.
 *
 * One height function feeds both the collider and the mesh, so what you see
 * and what you hit cannot drift apart. Everything is deterministic — no
 * randomness at runtime — because an obstacle course that reshuffles itself
 * between loads is not a course, and because the obstacle props are placed by
 * sampling this same function.
 *
 * Units are game units: one is about 85 mm, so the truck is 1.78 long and the
 * summit at 8 is roughly 68 cm above the trailhead. That is a tall backyard
 * course at 1/30, not a mountain.
 */

export const TERRAIN_SIZE = 92;
/** Collider and mesh resolution. 160 gives ~0.57u between samples. */
export const TERRAIN_SEGS = 160;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function hash(ix: number, iy: number) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return lerp(
    lerp(hash(ix, iy), hash(ix + 1, iy), u),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  );
}

function fbm(x: number, y: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    freq *= 2.07;
    amp *= 0.5;
  }
  return sum;
}

/** Distance from a point to a line segment — used to carve runs and ridges. */
function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len = vx * vx + vz * vz;
  const t = len === 0 ? 0 : clamp01((wx * vx + wz * vz) / len);
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}

/* ── Named places. Obstacles are placed against these, not by eye. ── */

export const PLACES = {
  trailhead: { x: 2, z: 34 },
  rockCrawl: { x: -20, z: 6 },
  stream: { from: { x: -34, z: 17 }, to: { x: 30, z: 23 } },
  canyonMouth: { x: 20, z: 16 },
  canyonTop: { x: 16, z: -16 },
  summit: { x: -4, z: -34 },
  pit: { x: 30, z: 33 },
} as const;

/**
 * The route, in the order the course is meant to be taken. These double as
 * respawn points: fall off a ledge and you come back at the last one reached,
 * not at the start, because losing ten minutes of climbing to one bad line is
 * how someone closes the tab.
 */
export const CHECKPOINTS = [
  { id: "01", name: "Trailhead", x: 2, z: 34 },
  { id: "02", name: "Log bridge", x: -26, z: 19 },
  { id: "03", name: "Rock crawl", x: -20, z: 6 },
  { id: "04", name: "Canyon", x: 18, z: 2 },
  { id: "05", name: "Summit", x: -4, z: -34 },
] as const;

export const CHECKPOINT_RANGE = 5.5;

/** Blend the ground toward a flat pad — pit areas, checkpoint landings. */
function pad(h: number, x: number, z: number, cx: number, cz: number, r: number, to: number) {
  const k = 1 - smoothstep(r * 0.55, r, Math.hypot(x - cx, z - cz));
  return lerp(h, to, k);
}

/**
 * Distance from the stream's centreline. Water and mud are regions, not a
 * height test: the canyon floor sits below the water line too, and driving
 * through it should not sound like a ford.
 */
export function streamDist(x: number, z: number) {
  return distToSegment(x, z, PLACES.stream.from.x, PLACES.stream.from.z, PLACES.stream.to.x, PLACES.stream.to.z);
}

export const STREAM_HALF_WIDTH = 3.6;
/** How churned the ground is, 0 to 1 — the banks either side of the water. */
export function mudAt(x: number, z: number) {
  const d = streamDist(x, z);
  return 1 - smoothstep(STREAM_HALF_WIDTH, STREAM_HALF_WIDTH + 3.2, d);
}

export function heightAt(x: number, z: number): number {
  let h = 0;

  // The land rises toward the north (−Z) and finishes at the summit.
  const north = smoothstep(-6, -40, z);
  h += north * 7.6;
  h = pad(h, x, z, PLACES.summit.x, PLACES.summit.z, 7, 8.4);

  // Canyon: two ridges running north with a drivable gully between them.
  const spine = distToSegment(x, z, PLACES.canyonMouth.x, PLACES.canyonMouth.z, PLACES.canyonTop.x, PLACES.canyonTop.z);
  const wall = smoothstep(9.5, 3.4, spine) * (1 - smoothstep(3.4, 2.2, spine));
  h += wall * 5.2 * (0.7 + fbm(x * 0.09, z * 0.09, 3) * 0.6);
  // and the gully floor itself, cut flat enough to drive
  h -= smoothstep(3.6, 1.2, spine) * 1.6;

  // Rock crawl field: medium-frequency lumps over a shallow dish.
  const rockMask = 1 - smoothstep(6, 15, Math.hypot(x - PLACES.rockCrawl.x, z - PLACES.rockCrawl.z));
  h += rockMask * (fbm(x * 0.26, z * 0.26, 3) - 0.45) * 2.9;

  // Stream bed, carved along its run and kept below the land around it.
  const bank = distToSegment(x, z, PLACES.stream.from.x, PLACES.stream.from.z, PLACES.stream.to.x, PLACES.stream.to.z);
  h -= smoothstep(4.2, 0.6, bank) * 1.35;

  // General ground texture everywhere — never flat, never noisy enough to
  // make a line hard to read.
  h += (fbm(x * 0.055, z * 0.055, 4) - 0.5) * 2.2;
  h += (fbm(x * 0.4, z * 0.4, 2) - 0.5) * 0.17;

  // Trailhead and pit are graded flat, because that is where you start and
  // where the bench is.
  h = pad(h, x, z, PLACES.trailhead.x, PLACES.trailhead.z, 11, 0.1);
  h = pad(h, x, z, PLACES.pit.x, PLACES.pit.z, 9, 0.1);

  // The rim lifts, so the park is bounded by land rather than an invisible wall.
  const edge = Math.max(Math.abs(x), Math.abs(z)) / (TERRAIN_SIZE / 2);
  h += smoothstep(0.78, 1.0, edge) * 9;

  return h;
}

/** Surface normal, by sampling. Used to orient scatter so it sits on slopes. */
export function normalAt(x: number, z: number, e = 0.4): [number, number, number] {
  const hL = heightAt(x - e, z);
  const hR = heightAt(x + e, z);
  const hD = heightAt(x, z - e);
  const hU = heightAt(x, z + e);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** 0 flat, 1 vertical. */
export function slopeAt(x: number, z: number) {
  return 1 - normalAt(x, z)[1];
}

/**
 * Heights for Rapier's heightfield.
 *
 * The outer index walks x and the inner walks z — the transpose of the
 * obvious layout. Rapier reads the array as a column-major matrix whose rows
 * run along x, so filling it the natural way puts the collider at
 * `heightAt(z, x)`: a surface that matches the mesh along the diagonal and
 * nowhere else, which is exactly how it presented — the truck sat on the
 * ground near the middle and sank almost a metre eight units away.
 *
 * Verified by driving and comparing the body's height against `heightAt` at
 * the same point, not by reasoning about the convention.
 */
export function buildHeights(segs = TERRAIN_SEGS, size = TERRAIN_SIZE): Float32Array {
  const n = segs + 1;
  const out = new Float32Array(n * n);
  const half = size / 2;
  for (let xi = 0; xi < n; xi++) {
    for (let zi = 0; zi < n; zi++) {
      const x = -half + (xi / segs) * size;
      const z = -half + (zi / segs) * size;
      out[xi * n + zi] = heightAt(x, z);
    }
  }
  return out;
}
