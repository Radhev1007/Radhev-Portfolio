import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BONES, skinWeights, cullSeams, buildSkeleton, poseSeated, poseWalk, FIGURE } from '../../public/rc-crawler/src/vehicles/driverRig.js';
import { OnFoot, exitSpot, canExit } from '../../public/rc-crawler/src/world/onFoot.js';

const boneIndex = (name) => BONES.findIndex((b) => b.name === name);
const primary = (pts) => { const w = skinWeights(new Float32Array(pts.flat())); return pts.map((_, i) => { let best = 0; for (let k = 1; k < 4; k++) if (w.weight[i * 4 + k] > w.weight[i * 4 + best]) best = k; return BONES[w.index[i * 4 + best]].name; }); };

test('points on the figure go to the bone they belong to', () => {
  const [head, chest, lElbow, rKnee, lShin, lPocket, rWrist] = primary([
    [0, 0.8, 0.02],        // face
    [0, 0.4, 0.08],        // chest front
    [0.25, 0.2, -0.06],    // left elbow
    [-0.07, -0.44, 0.03],  // right knee front
    [0.19, -0.62, -0.06],  // left shin
    [0.17, -0.12, 0.06],   // left pocket, on the thigh below the hand
    [-0.17, 0.0, 0.04],    // right wrist
  ]);
  assert.equal(head, 'head');
  assert.ok(['chest', 'spine'].includes(chest), chest);
  assert.ok(['upperArmL', 'foreArmL'].includes(lElbow), lElbow);
  assert.ok(['thighR', 'shinR'].includes(rKnee), rKnee);
  assert.equal(lShin, 'shinL');
  assert.equal(lPocket, 'thighL');
  assert.ok(['foreArmR', 'handR'].includes(rWrist), rWrist);
});

test('weights sum to one and blend across a joint', () => {
  const w = skinWeights(new Float32Array([0, 0.8, 0, 0.21, 0.36, -0.05, 0.13, -0.44, -0.03]));
  for (let i = 0; i < 3; i++) { const s = [0, 1, 2, 3].reduce((t, k) => t + w.weight[i * 4 + k], 0); assert.ok(Math.abs(s - 1) < 1e-5, `vertex ${i} sums to ${s}`); }
  // the knee is shared by thigh and shin
  const knee = [0, 1, 2, 3].filter((k) => w.weight[2 * 4 + k] > 0.15).map((k) => BONES[w.index[2 * 4 + k]].name).sort();
  assert.deepEqual(knee, ['shinL', 'thighL']);
});

test('triangles joining a hand to the trouser pocket are cut, the rest kept', () => {
  const pos = new Float32Array([0.22, 0.0, 0.02, 0.2, -0.12, 0.06, 0.16, -0.14, 0.06, 0, 0.4, 0.1, 0.05, 0.4, 0.1, 0.02, 0.45, 0.1]);
  const w = skinWeights(pos);
  const kept = cullSeams(new Uint32Array([0, 1, 2, 3, 4, 5]), w.group);
  assert.deepEqual([...kept], [3, 4, 5]);
});

test('the skeleton binds at the standing pose and seats the figure', () => {
  const rig = buildSkeleton();
  rig.root.updateMatrixWorld(true);
  const p = (n) => rig.bones[n].getWorldPosition(new THREE.Vector3());
  assert.ok(p('head').y > 0.65 && p('ankleL').y < -0.75, 'standing');
  poseSeated(rig, {});
  rig.root.updateMatrixWorld(true);
  // seated: knees forward of the hips at about hip height, ankles below the knees, head still on top
  assert.ok(p('shinL').z > 0.3 && Math.abs(p('shinL').y - p('thighL').y) < 0.2, `knee ${p('shinL').toArray()}`);
  assert.ok(p('ankleL').y < p('shinL').y - 0.2, 'ankle below the knee');
  assert.ok(p('head').y > 0.6, 'head up');
  // hands forward, at the wheel in front of the chest
  assert.ok(p('handL').z > 0.2 && p('handR').z > 0.2, `hands ${p('handL').z} ${p('handR').z}`);
  // steering turns the hands opposite ways
  const before = p('handL').y;
  poseSeated(rig, { steer: 1 }); rig.root.updateMatrixWorld(true);
  assert.ok(Math.abs(p('handL').y - before) > 0.03, 'left hand moves with the wheel');
});

test('the walk swings the legs in opposite phase', () => {
  const rig = buildSkeleton();
  poseWalk(rig, Math.PI / 2, 1); rig.root.updateMatrixWorld(true);
  const zl = rig.bones.ankleL.getWorldPosition(new THREE.Vector3()).z, zr = rig.bones.ankleR.getWorldPosition(new THREE.Vector3()).z;
  assert.ok(zl * zr < 0 && Math.abs(zl - zr) > 0.2, `${zl} ${zr}`);
});

// ---------------------------------------------------------------- on foot
const flat = (fn = () => 0) => ({ half: 50, heightAt: fn, waterDepthAt: () => 0 });

test('walking: W walks forward along the facing, A turns left, he stays on the ground', () => {
  const f = new OnFoot(); f.place(new THREE.Vector3(0, 0, 0), 0);
  for (let i = 0; i < 60; i++) f.update(1 / 60, { forward: 1, turn: 0, run: false }, flat(), []);
  assert.ok(f.pos.z > 0.3 && Math.abs(f.pos.x) < 1e-6, `z ${f.pos.z}`);
  const z1 = f.pos.z;
  for (let i = 0; i < 60; i++) f.update(1 / 60, { forward: 1, turn: 0, run: true }, flat(), []);
  assert.ok(f.pos.z - z1 > (z1 - 0) * 1.8, 'running is faster');
  const yaw0 = f.yaw; f.update(0.2, { forward: 0, turn: 1, run: false }, flat(), []);
  assert.ok(f.yaw > yaw0, 'turns left');
  const hill = flat((x, z) => 0.1 * z);
  f.update(1 / 60, { forward: 0, turn: 0 }, hill, []);
  assert.ok(Math.abs(f.pos.y - hill.heightAt(f.pos.x, f.pos.z)) < 1e-6, 'on the ground');
});

test('walking: trees and walls stop him', () => {
  const f = new OnFoot(); f.place(new THREE.Vector3(0, 0, 0), 0);
  for (let i = 0; i < 240; i++) f.update(1 / 60, { forward: 1, turn: 0, run: true }, flat(), [{ x: 0, z: 1, r: 0.3 }]);
  assert.ok(f.pos.z < 1 - 0.3, `walked into the trunk: ${f.pos.z}`);
  const g = new OnFoot(); g.place(new THREE.Vector3(0, 0, 0), 0);
  const cliff = flat((x, z) => (z > 0.5 ? 3 : 0));
  for (let i = 0; i < 240; i++) g.update(1 / 60, { forward: 1, turn: 0, run: true }, cliff, []);
  assert.ok(g.pos.z < 0.55, `climbed the cliff: ${g.pos.z}`);
});

test('getting out: only when the truck is upright and stopped; he steps out beside it', () => {
  const up = { up: new THREE.Vector3(0, 1, 0), stats: { speed: 0 } };
  assert.equal(canExit(up), true);
  assert.equal(canExit({ ...up, stats: { speed: 2 } }), false);
  assert.equal(canExit({ ...up, up: new THREE.Vector3(1, 0, 0) }), false);
  const s = exitSpot(flat(), new THREE.Vector3(5, 0, 5), 0);
  assert.ok(Math.abs(Math.hypot(s.x - 5, s.z - 5) - FIGURE.exitDist) < 1e-6 && s.x > 5, 'on the driver\'s (left) side');
  const wallLeft = flat((x) => (x > 5.3 ? 4 : 0));
  const t = exitSpot(wallLeft, new THREE.Vector3(5, 0, 5), 0);
  assert.ok(t.x < 5, 'the other side when the driver\'s side is blocked');
});
