import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAM_MODES, mountedView } from '../../public/rc-crawler/src/camera/cameraRig.js';
import { Gamepad, padState } from '../../public/rc-crawler/src/core/gamepad.js';

const truck = (yaw = 0, roll = 0) => { const o = new THREE.Object3D(); o.position.set(2, 1, 3); o.rotation.set(0, yaw, roll, 'YXZ'); o.updateMatrixWorld(true); return o; };
const info = { noseZ: 0.82, halfTrack: 0.34, wheelR: 0.2, hubY: -0.1, eye: null, hood: 0.3 };
const local = (car, p) => car.worldToLocal(p.clone());

test('the new camera modes are added after the old ones (their numbers stay)', () => {
  assert.deepEqual(CAM_MODES.slice(0, 5), ['Chase', 'Close RC', 'Low Ground', 'Cinematic', 'Free']);
  assert.deepEqual(CAM_MODES.slice(5), ['Bumper', 'Wheel', 'Driver']);
});

test('bumper camera: low, just ahead of the nose, looking forward', () => {
  const car = truck(0.7);
  const v = mountedView('Bumper', car, info);
  const p = local(car, v.pos), l = local(car, v.look);
  assert.ok(p.z > info.noseZ && p.z < info.noseZ + 0.1 && p.y < 0.2, `pos ${p.toArray()}`);
  assert.ok(l.z > p.z + 1 && Math.abs(l.x) < 1e-6, 'looks straight ahead');
});

test('wheel camera: outside the front-left wheel, looking at its hub', () => {
  const car = truck();
  const v = mountedView('Wheel', car, info);
  const p = local(car, v.pos), l = local(car, v.look);
  assert.ok(p.x > info.halfTrack + 0.2, 'outside the wheel');
  assert.ok(Math.abs(l.x - info.halfTrack) < 0.05 && Math.abs(l.z - 0.56) < 0.05 && Math.abs(l.y - info.hubY) < 0.05, `look ${l.toArray()}`);
});

test('driver camera: at the driver\'s eyes when he is seated, else over the hood; it rolls with the truck', () => {
  const car = truck(0, 0.3);
  const eye = new THREE.Vector3(0.16, 0.42, -0.2).applyMatrix4(car.matrixWorld);
  const a = mountedView('Driver', car, { ...info, eye });
  assert.ok(local(car, a.pos).distanceTo(new THREE.Vector3(0.16, 0.42, -0.2)) < 0.08, 'at the eyes');
  const b = mountedView('Driver', car, info);
  const pb = local(car, b.pos);
  assert.ok(pb.y > info.hood && pb.z > 0, `over the hood ${pb.toArray()}`);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.quaternion);
  assert.ok(b.up.angleTo(up) < 1e-6, 'up is the truck\'s up');
});

test('gamepad: left stick steers, triggers drive, a deadzone stops drift', () => {
  const pad = (o) => ({ axes: [o.lx ?? 0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (o.pressed || []).includes(i), value: o.values?.[i] ?? ((o.pressed || []).includes(i) ? 1 : 0) })) });
  assert.deepEqual(padState(pad({ lx: 0.05 })), { throttle: 0, steer: 0, handbrake: false });
  const s = padState(pad({ lx: -1, values: { 7: 0.8 } }));
  assert.ok(s.steer > 0.95 && Math.abs(s.throttle - 0.8) < 0.05, 'stick left steers left, right trigger throttles');
  assert.ok(padState(pad({ values: { 6: 1 } })).throttle < -0.95, 'left trigger reverses');
  assert.equal(padState(pad({ pressed: [0] })).handbrake, true, 'A brakes');
  // buttons fire once per press, mapped to the keyboard keys
  const g = new Gamepad(); const fired = [];
  g.poll(pad({ pressed: [3] }), (k) => fired.push(k)); g.poll(pad({ pressed: [3] }), (k) => fired.push(k)); g.poll(pad({}), (k) => fired.push(k)); g.poll(pad({ pressed: [3, 2] }), (k) => fired.push(k));
  assert.deepEqual(fired, ['c', 'f', 'c']);   // held: once; released and pressed again with X: X (button 2), then Y (3)
});
