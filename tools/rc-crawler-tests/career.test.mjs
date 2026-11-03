import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Career, ACHIEVEMENTS, rankFor, trailFraction } from '../../public/rc-crawler/src/world/career.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
// a frame of driving: speed m/s for dt s, in vehicle `v` on terrain `lvl`
const drive = (c, { speed = 1, dt = 1 / 30, s = 1, v = 'scx30', lvl = 'forest', wood = false, water = 0, upside = 0 } = {}) => {
  for (let t = 0; t < s; t += dt) c.update(dt, { vehicle: v, level: lvl, speed, onWood: wood, water, upsideTimer: upside });
};

test('driving adds up distance, time and top speed, overall and per vehicle', () => {
  const c = new Career(mem());
  drive(c, { speed: 2, s: 10 });
  drive(c, { speed: 0.5, s: 4, v: 'willys' });
  assert.ok(Math.abs(c.stats.distance - 22) < 0.2, `distance ${c.stats.distance}`);
  assert.ok(Math.abs(c.stats.time - 14) < 0.1);
  assert.ok(Math.abs(c.stats.topSpeed - 2) < 1e-9);
  assert.ok(Math.abs(c.vehicles.scx30.distance - 20) < 0.2 && Math.abs(c.vehicles.willys.distance - 2) < 0.1);
  assert.ok(Math.abs(c.vehicles.willys.topSpeed - 0.5) < 1e-9);
});

test('XP: 1 per 10 m driven, medals by colour (upgrades pay the difference), trail progress, achievements', () => {
  const c = new Career(mem());
  drive(c, { speed: 10, s: 10 });   // 100 m
  const afterDrive = c.xp;
  assert.ok(afterDrive >= 10 && afterDrive < 10 + 100 + 1, `${afterDrive}`);   // (+ maybe an achievement)
  for (const a of ACHIEVEMENTS) c.unlocked[a.id] = 1;   // (achievements pay their own 100: kept out of these sums)
  const x0 = c.xp; c.medal('forest:a', 'bronze'); assert.equal(c.xp - x0, 50);
  const x1 = c.xp; c.medal('forest:a', 'gold'); assert.equal(c.xp - x1, 150);   // gold 200 less the bronze already paid
  const x2 = c.xp; c.medal('forest:a', 'silver'); assert.equal(c.xp - x2, 0);   // a worse medal pays nothing
  const x3 = c.xp; c.trail('forest', 0.25); assert.equal(c.xp - x3, 25 * 2); c.trail('forest', 0.2); assert.equal(c.trail_.forest, 0.25);
});

test('ranks climb with XP', () => {
  assert.equal(rankFor(0).level, 1);
  const r = rankFor(1000);
  assert.ok(r.level > 1 && r.into >= 0 && r.into < r.need && typeof r.title === 'string');
  assert.ok(rankFor(100000).level > r.level);
});

test('events: a rollover, a bridge crossed, a creek forded', () => {
  const c = new Career(mem());
  drive(c, { upside: 1.5, s: 0.2, speed: 0 });
  drive(c, { s: 1, speed: 0 });
  assert.equal(c.stats.rollovers, 1, 'one rollover per roll');
  drive(c, { wood: true, speed: 1, s: 3 }); drive(c, { s: 1 });
  assert.equal(c.stats.bridges, 1);
  drive(c, { wood: true, speed: 0.1, s: 0.3 }); drive(c, { s: 1 });
  assert.equal(c.stats.bridges, 1, 'a brush with a plank is not a crossing');
  drive(c, { water: 0.5, speed: 0.8, s: 4 }); drive(c, { s: 1 });
  assert.equal(c.stats.creeks, 1);
});

test('achievements unlock once, from real state, and pay XP', () => {
  const c = new Career(mem()); const got = [];
  c.onUnlock = (a) => got.push(a.id);
  drive(c, { speed: 10, s: 101 });   // > 1 km
  assert.ok(got.includes('km1'));
  const n = got.length; drive(c, { speed: 10, s: 5 }); assert.equal(got.length, n, 'never twice');
  assert.ok(ACHIEVEMENTS.length >= 12 && ACHIEVEMENTS.every((a) => a.id && a.name && a.desc));
});

test('it is saved and loaded', () => {
  const store = mem();
  const a = new Career(store); drive(a, { speed: 3, s: 20 }); a.medal('mud:x', 'silver'); a.save();
  const b = new Career(store);
  assert.ok(Math.abs(b.stats.distance - a.stats.distance) < 1e-6 && b.xp === a.xp && b.medals['mud:x'] === 'silver');
});

test('trail completion: how far along the trail the truck is, if it is on it', () => {
  const path = { len: 100, N: 100, pts: Array.from({ length: 101 }, (_, i) => ({ x: i, z: 0 })) };
  assert.ok(Math.abs(trailFraction(path, { x: 40, z: 0.5 }) - 0.4) < 0.011);
  assert.equal(trailFraction(path, { x: 40, z: 9 }), null, 'off the trail');
});
