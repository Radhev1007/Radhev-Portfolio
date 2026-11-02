import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringFor, nearestRing, buildRings } from '../../public/rc-crawler/src/world/challengeRings.js';

const ch = (id, x, z, width, tier = 'Beginner') => ({ id, name: id, tier, gates: [{ x, z, yaw: 0, width }] });

test('ring radius follows the start gate, never under 1.6 m', () => {
  assert.equal(ringFor(ch('a', 0, 0, 2)).r, 1.6);
  assert.equal(ringFor(ch('b', 0, 0, 4)).r, 2.4);
  const r = ringFor(ch('c', 3, -2, 2, 'Expert'));
  assert.deepEqual([r.id, r.tier], ['c', 'Expert']);
});

test('the ring sits just before the start line, clear of the gate posts', () => {
  const r = ringFor(ch('a', 3, -2, 2));          // gate at (3,-2), crossed toward +z, posts at x = 2 and 4
  assert.ok(Math.abs(r.x - 3) < 1e-9 && Math.abs(r.z - (-2 - 2.1)) < 1e-9, `ring at ${r.x},${r.z}`);
  for (const px of [2, 4]) assert.ok(Math.hypot(px - r.x, -2 - r.z) > r.r + 0.3, 'a gate post is inside the ring');
  assert.ok(r.z + r.r < -2, 'the ring reaches over the start line');
});

test('nearestRing picks the closer of two overlapping rings', () => {
  const rings = [{ id: 'far', x: 0, z: 0, r: 2.4 }, { id: 'near', x: 2, z: 0, r: 2.4 }];
  assert.equal(nearestRing(rings, 1.8, 0).id, 'near');
  assert.equal(nearestRing(rings, 0.2, 0).id, 'far');
});

test('nearestRing is null just outside the radius', () => {
  const rings = [{ id: 'a', x: 0, z: 0, r: 1.6 }];
  assert.equal(nearestRing(rings, 1.59, 0).id, 'a');
  assert.equal(nearestRing(rings, 1.61, 0), null);
});

// a level with one challenge and a challenge manager in a given state
function world(state) {
  const c = ch('a', 0, 0, 2);
  const level = { hf: { heightAt: () => 0 }, challenges: [c] };
  const mgr = { active: state === 'idle' ? null : c, state, medalOf: () => null };
  const rings = buildRings(level, mgr);
  const r = rings.rings[0];
  return { rings, at: { pos: { x: r.x, z: r.z } } };
}

test('a ring offers its challenge again once the last one has finished', () => {
  const { rings, at } = world('done');
  assert.equal(rings.update(0.016, at)?.id, 'a');
});

test('rings stay quiet while a challenge is armed or running', () => {
  for (const st of ['armed', 'running']) { const { rings, at } = world(st); assert.equal(rings.update(0.016, at), null, st); }
  const { rings, at } = world('idle');
  assert.equal(rings.update(0.016, at)?.id, 'a');
});
