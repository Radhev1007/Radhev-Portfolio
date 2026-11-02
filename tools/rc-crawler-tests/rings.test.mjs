import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringFor, nearestRing } from '../../public/rc-crawler/src/world/challengeRings.js';

const ch = (id, x, z, width, tier = 'Beginner') => ({ id, name: id, tier, gates: [{ x, z, yaw: 0, width }] });

test('ring radius follows the start gate, never under 1.6 m', () => {
  assert.equal(ringFor(ch('a', 0, 0, 2)).r, 1.6);
  assert.equal(ringFor(ch('b', 0, 0, 4)).r, 2.4);
  const r = ringFor(ch('c', 3, -2, 2, 'Expert'));
  assert.deepEqual([r.id, r.x, r.z, r.tier], ['c', 3, -2, 'Expert']);
});

test('nearestRing picks the closer of two overlapping rings', () => {
  const rings = [ringFor(ch('far', 0, 0, 4)), ringFor(ch('near', 2, 0, 4))];
  assert.equal(nearestRing(rings, 1.8, 0).id, 'near');
  assert.equal(nearestRing(rings, 0.2, 0).id, 'far');
});

test('nearestRing is null just outside the radius', () => {
  const rings = [ringFor(ch('a', 0, 0, 2))];
  assert.equal(nearestRing(rings, 1.59, 0).id, 'a');
  assert.equal(nearestRing(rings, 1.61, 0), null);
});
