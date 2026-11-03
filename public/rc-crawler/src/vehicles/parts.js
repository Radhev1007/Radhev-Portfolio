// The garage: parts that change how the truck drives. Each option is a set of multipliers on the physics
// (physics/vehicle.js setSetup): grip by surface, spring and damping, motor torque and free speed, battery
// drain, throttle response, track width, centre of mass and how the chassis slides on rock. Stock parts are all
// 1 (or 0): the truck drives exactly as it was tuned.
import { SURF } from '../terrain/heightfield.js';

export const PARTS = {
  tyres: { name: 'Tyres', options: [
    { id: 'at', name: 'All-terrain', desc: 'The stock tread: good everywhere, best nowhere.' },
    { id: 'mt', name: 'Mud terrain', desc: 'Deep lugs that bite in mud, sand and grass; they slip more on bare rock.', compound: { [SURF.MUD]: 1.25, [SURF.SAND]: 1.15, [SURF.GRASS]: 1.1, [SURF.DIRT]: 1.05, [SURF.ROCK]: 0.9, [SURF.WOOD]: 0.95 } },
    { id: 'sticky', name: 'Sticky rock compound', desc: 'Soft rubber that grips rock and wood; it clogs in mud and sand.', compound: { [SURF.ROCK]: 1.2, [SURF.WOOD]: 1.12, [SURF.GRAVEL]: 1.05, [SURF.MUD]: 0.85, [SURF.SAND]: 0.9 } },
  ] },
  shocks: { name: 'Shocks', options: [
    { id: 'stock', name: 'Stock oil shocks', desc: 'Balanced springs and damping.' },
    { id: 'soft', name: 'Soft crawler springs', desc: 'More articulation and grip over rocks, more body roll.', spring: 0.8, damp: 0.8 },
    { id: 'firm', name: 'Firm trail springs', desc: 'Less sag and roll at speed; the tyres lift sooner on rough ground.', spring: 1.25, damp: 1.3 },
  ] },
  motor: { name: 'Motor', options: [
    { id: 't35', name: '35T brushed (stock)', desc: 'The stock crawler motor.' },
    { id: 't45', name: '45T low-speed', desc: 'More torque, lower top speed: slow, precise crawling.', torque: 1.2, speed: 0.8 },
    { id: 't27', name: '27T trail', desc: 'More top speed, less torque on the climbs.', torque: 0.9, speed: 1.25 },
  ] },
  battery: { name: 'Battery', options: [
    { id: 's2', name: '2S 2200 mAh (stock)', desc: 'The stock pack.' },
    { id: 'mah5000', name: '2S 5000 mAh', desc: 'More than twice the runtime.', drain: 0.45 },
    { id: 's3', name: '3S 3000 mAh', desc: 'Higher voltage: more speed and punch, and it drains faster.', speed: 1.2, torque: 1.08, drain: 1.2 },
  ] },
  esc: { name: 'ESC', options: [
    { id: 'stock', name: 'Stock', desc: 'The stock throttle response.' },
    { id: 'crawl', name: 'Crawl profile', desc: 'A smooth, gentle throttle for creeping over obstacles.', throttle: 0.7 },
    { id: 'sport', name: 'Sport profile', desc: 'A sharp, fast throttle for the trail.', throttle: 1.6 },
  ] },
  offset: { name: 'Wheel offset', options: [
    { id: 'stock', name: 'Stock', desc: 'The stock track width.' },
    { id: 'narrow', name: 'Narrow (−2 cm)', desc: 'Squeezes through tight gaps; rolls over sooner.', track: -0.02 },
    { id: 'wide', name: 'Wide (+2.5 cm)', desc: 'A wider stance that resists rolling; it needs wider gaps.', track: 0.025 },
  ] },
  acc: { name: 'Accessories', multi: true, options: [
    { id: 'lightbar', name: 'LED light bar', desc: 'A roof light bar that comes on with the headlights.' },
    { id: 'rack', name: 'Roof rack', desc: 'Looks the part; its weight up high makes the truck tip sooner.', comLift: 0.025 },
    { id: 'sliders', name: 'Rock sliders', desc: 'Steel tubes along the sills: the chassis slides off rocks instead of hanging up.', chassisMu: 0.7 },
    { id: 'bumper', name: 'Tube bumper', desc: 'A steel tube front bumper.' },
  ] },
};

export const STOCK = { tyres: 'at', shocks: 'stock', motor: 't35', battery: 's2', esc: 'stock', offset: 'stock', acc: [] };

const opt = (cat, id) => PARTS[cat].options.find((o) => o.id === id) || PARTS[cat].options[0];

/** The physics multipliers for a set of parts (missing categories are stock). */
export function partsSetup(parts = STOCK) {
  const p = { ...STOCK, ...parts };
  const chosen = [...['tyres', 'shocks', 'motor', 'battery', 'esc', 'offset'].map((c) => opt(c, p[c])), ...(p.acc || []).map((id) => opt('acc', id))];
  const s = { spring: 1, damp: 1, torque: 1, speed: 1, drain: 1, throttle: 1, track: 0, comLift: 0, chassisMu: 1, compound: {} };
  for (const o of chosen) {
    for (const k of ['spring', 'damp', 'torque', 'speed', 'drain', 'throttle', 'chassisMu']) if (o[k] != null) s[k] *= o[k];
    if (o.track) s.track += o.track;
    if (o.comLift) s.comLift += o.comLift;
    if (o.compound) Object.assign(s.compound, o.compound);
  }
  return s;
}

/**
 * Bars for the garage (0..1, stock = 0.5): grip (the tyres' average over the common surfaces), top speed,
 * torque, stability (track, springs and centre of mass) and runtime.
 */
export function partStats(parts = STOCK) {
  const s = partsSetup(parts), bar = (x) => Math.max(0, Math.min(1, 0.5 + x));
  const surfs = [SURF.DIRT, SURF.ROCK, SURF.MUD, SURF.SAND, SURF.GRASS];
  const grip = surfs.reduce((t, k) => t + (s.compound[k] ?? 1), 0) / surfs.length;
  return {
    grip: bar((grip - 1) * 3),
    speed: bar((s.speed - 1) * 1.2),
    torque: bar((s.torque - 1) * 1.6),
    stability: bar(s.track * 6 + (s.spring - 1) * 0.6 - s.comLift * 8),
    runtime: bar((1 / s.drain - 1) * 0.3),
  };
}
