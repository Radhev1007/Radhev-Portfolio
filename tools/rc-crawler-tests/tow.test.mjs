import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { towApproach, rightedPose } from '../../public/rc-crawler/src/world/towTruck.js';

const hf = (fn = () => 0, half = 80) => ({ half, heightAt: fn });

test('the tow truck comes from behind the wreck when the way is clear', () => {
  const p = towApproach(hf(), new THREE.Vector3(0, 0, 0), 0);     // wreck faces +z
  assert.ok(p.from.z < -13.9 && Math.abs(p.from.x) < 1e-6, `from ${p.from.x},${p.from.z}`);
  assert.ok(Math.abs(p.stop.z + 3.4) < 1e-6);
  assert.ok(Math.abs(Math.cos(p.faceYaw) - 1) < 1e-6, 'it faces the wreck');
});

test('a wall behind sends it round another side', () => {
  const wall = (x, z) => (z < -6 ? 5 : 0);
  const p = towApproach(hf(wall), new THREE.Vector3(0, 0, 0), 0);
  assert.ok(p && p.from.z > -6.1, `came through the wall from ${p?.from.z}`);
});

test('it never drives in from outside the map', () => {
  const p = towApproach(hf(() => 0, 20), new THREE.Vector3(0, 0, -15), 0);    // wreck near the -z edge
  assert.ok(p && Math.abs(p.from.z) <= 17 && Math.abs(p.from.x) <= 17, `from ${p?.from.x},${p?.from.z}`);
});

test('the wreck is winched upright on the same spot and heading', () => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.1, Math.PI * 0.9, 'YXZ'));
  const r = rightedPose(new THREE.Vector3(4, 1, -2), q);
  assert.deepEqual([r.x, r.z], [4, -2]);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(r.q);
  assert.ok(up.y > 0.999, 'upright');
  const f0 = new THREE.Vector3(0, 0, 1).applyQuaternion(q), f1 = new THREE.Vector3(0, 0, 1).applyQuaternion(r.q);
  assert.ok(Math.abs(Math.atan2(f0.x, f0.z) - Math.atan2(f1.x, f1.z)) < 1e-6, 'same heading');
});
