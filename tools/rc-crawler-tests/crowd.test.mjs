import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { crowdSpots, buildCrowd } from '../../public/rc-crawler/src/world/crowd.js';
import { ringFor } from '../../public/rc-crawler/src/world/challengeRings.js';

const flat = (steepX = Infinity, waterX = Infinity) => ({
  half: 80,
  heightAt: (x) => (x > steepX ? (x - steepX) * 3 : 0),
  normalAt: (x, z, o) => (x > steepX ? o.set(-3, 1, 0).normalize() : o.set(0, 1, 0)),
  waterDepthAt: (x) => (x < waterX ? 0 : 0.4),
});
const challenge = (x, z, yaw = 0, width = 2) => ({ id: `c${x}`, name: 'C', tier: 'Beginner', gates: [{ x, z, yaw, width }] });
const ringsFor = (cs) => cs.map((c) => ({ ...ringFor(c), c }));

test('spectators stand beside each challenge start, never in its ring or across the start gate', () => {
  const rings = ringsFor([challenge(0, 0), challenge(20, 10, Math.PI / 2, 3)]);
  const spots = crowdSpots({ hf: flat(), gateways: [] }, rings, () => 0.5);
  assert.ok(spots.length >= 12, `only ${spots.length} spectators`);
  for (const s of spots) for (const r of rings) {
    assert.ok(Math.hypot(s.x - r.x, s.z - r.z) > r.r + 1.5, 'someone stands in a ring');
    const g = r.c.gates[0];
    const lat = Math.abs((s.x - g.x) * Math.cos(g.yaw) - (s.z - g.z) * Math.sin(g.yaw));
    const along = (s.x - g.x) * Math.sin(g.yaw) + (s.z - g.z) * Math.cos(g.yaw);
    assert.ok(!(lat < g.width / 2 + 0.5 && Math.abs(along) < 1), 'someone stands in the start gate');
  }
});

test('nobody stands on a steep bank or in water', () => {
  const rings = ringsFor([challenge(0, 0)]);
  const all = crowdSpots({ hf: flat(), gateways: [] }, rings, () => 0.5).length;
  const banked = crowdSpots({ hf: flat(0), gateways: [] }, rings, () => 0.5);
  assert.ok(banked.length < all && banked.every((s) => s.x <= 0), 'people on the bank');
  const wet = crowdSpots({ hf: flat(Infinity, 0), gateways: [] }, rings, () => 0.5);
  assert.ok(wet.every((s) => s.x < 0), 'people in the water');
});

test('a truck driving at someone makes them step aside', () => {
  const rings = ringsFor([challenge(0, 0)]);
  const crowd = buildCrowd({ hf: flat(), gateways: [] }, rings);
  const q = crowd.people[0], x = q.x, z = q.z;
  const truck = new THREE.Vector3(x + 1, 0, z), vel = new THREE.Vector3(-2, 0, 0);
  for (let i = 0; i < 30; i++) crowd.update(1 / 60, truck, vel);
  assert.ok(Math.hypot(q.x + q.ox - truck.x, q.z + q.oz - truck.z) > 1.4, 'still in the way');
});
