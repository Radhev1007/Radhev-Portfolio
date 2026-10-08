import { heightAt, PLACES } from "./heightfield";

/**
 * What the park keeps track of: where you are, what you have found, and what
 * you have managed.
 *
 * Zones are read from position rather than gated. Gating a course this size
 * would mean locking someone out of the interesting half until they have done
 * the dull half, and the terrain already grades itself — the rock field is
 * harder than the trailhead whether or not a flag says so.
 */

export type Zone = {
  id: string;
  name: string;
  blurb: string;
  at: [number, number];
  radius: number;
};

export const ZONES: Zone[] = [
  { id: "01", name: "Trailhead", blurb: "Beginner trail", at: [PLACES.trailhead.x, PLACES.trailhead.z], radius: 17 },
  { id: "02", name: "Technical trail", blurb: "Water and timber", at: [-14, 19], radius: 18 },
  { id: "03", name: "Rock crawl", blurb: "Pick a line", at: [PLACES.rockCrawl.x, PLACES.rockCrawl.z], radius: 15 },
  { id: "04", name: "The canyon", blurb: "Narrow and deep", at: [18, 0], radius: 19 },
  { id: "05", name: "Summit", blurb: "Highest point", at: [PLACES.summit.x, PLACES.summit.z], radius: 16 },
];

export function zoneAt(x: number, z: number): Zone | null {
  let best: Zone | null = null;
  let bestD = Infinity;
  for (const zone of ZONES) {
    const d = Math.hypot(x - zone.at[0], z - zone.at[1]) / zone.radius;
    if (d < 1 && d < bestD) {
      best = zone;
      bestD = d;
    }
  }
  return best;
}

/**
 * Parts to find. Deliberately off the obvious lines — behind the canyon
 * wall, under the rope bridge, in the cave — so that exploring is rewarded
 * and rushing the summit is not.
 */
export type Part = {
  id: string;
  name: string;
  at: [number, number];
  /** Height above the ground; a couple sit on ledges rather than the floor. */
  lift?: number;
  hint: string;
};

export const PARTS: Part[] = [
  { id: "p1", name: "Spare driveshaft", at: [-31, 9], hint: "West of the rock field" },
  { id: "p2", name: "Shock set", at: [17, -7], lift: 0.4, hint: "Under the rope bridge" },
  { id: "p3", name: "Spur gear", at: [-29.5, 22.5], hint: "Beside the log bridge" },
  { id: "p4", name: "Servo horn", at: [25.5, 10], hint: "Canyon mouth, off the line" },
  { id: "p5", name: "Wheel weights", at: [-9.5, -24.5], hint: "In the cave on the summit climb" },
  { id: "p6", name: "Body clips", at: [-2, -30], lift: 0.3, hint: "Near the top" },
];

export const PART_RANGE = 2.4;

export function partPosition(p: Part): [number, number, number] {
  return [p.at[0], heightAt(p.at[0], p.at[1]) + 0.42 + (p.lift ?? 0), p.at[1]];
}

/* ── Achievements ───────────────────────────────────────────── */

export type Achievement = { id: string; name: string; how: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "roll", name: "Rolling out", how: "Leave the trailhead" },
  { id: "water", name: "Feet wet", how: "Cross the stream" },
  { id: "line", name: "Line chosen", how: "Clear the rock crawl" },
  { id: "wire", name: "High wire", how: "Cross the rope bridge" },
  { id: "summit", name: "Top out", how: "Reach the summit" },
  { id: "collector", name: "Full toolbox", how: "Find all six parts" },
];

/** The canyon crossing, shared so the bridge and its achievement agree. */
export const ROPE_BRIDGE = { from: [9, -7] as [number, number], to: [25, -7] as [number, number] };

/** Where the hidden passage sits, so the cave mesh and its part agree. */
export const CAVE = { at: [-10, -24] as [number, number], rotation: 0.5 };
