import { test } from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import { crossedGateway, placeReturnGateway } from '../../public/rc-crawler/src/world/gateways.js';
import { LevelContext } from '../../public/rc-crawler/src/levels/levelBuilder.js';

// a gateway at the origin facing +z (drive north to leave)
const g = { id: 'x', to: 'hub', x: 0, z: 0, yaw: 0, width: 3.2 };

test('driving forward through the arch counts', () => {
  assert.equal(crossedGateway(g, { x: 0, z: -0.3 }, { x: 0, z: 0.3 }, 1, 1), true);
});

test('crossing back inward does not count', () => {
  assert.equal(crossedGateway(g, { x: 0, z: 0.3 }, { x: 0, z: -0.3 }, 1, 1), false);
});

test('passing beside the arch does not count', () => {
  assert.equal(crossedGateway(g, { x: 1.7, z: -0.3 }, { x: 1.7, z: 0.3 }, 1, 1), false);
  assert.equal(crossedGateway(g, { x: 1.5, z: -0.3 }, { x: 1.5, z: 0.3 }, 1, 1), true);
});

test('a truck on its side does not travel', () => {
  assert.equal(crossedGateway(g, { x: 0, z: -0.3 }, { x: 0, z: 0.3 }, 1, 0.3), false);
});

test('reversing out of the arch does not travel', () => {
  assert.equal(crossedGateway(g, { x: 0, z: -0.3 }, { x: 0, z: 0.3 }, -1, 1), false);
  assert.equal(crossedGateway(g, { x: 0, z: -0.3 }, { x: 0, z: 0.3 }, 0.1, 1), false);
});

test('a gateway facing another way uses its own direction', () => {
  const e = { ...g, yaw: Math.PI / 2 };   // leave toward +x
  assert.equal(crossedGateway(e, { x: -0.3, z: 0 }, { x: 0.3, z: 0 }, 1, 1), true);
  assert.equal(crossedGateway(e, { x: -0.5, z: -0.3 }, { x: -0.5, z: 0.3 }, 1, 1), false);   // driving across, inside it
});

test('the return gateway sits 4 m behind the spawn on a levelled pad', () => {
  const ctx = new LevelContext({ id: 'slope', size: 30, seed: 3 }, 'low');
  ctx.fill((x, z) => x * 0.2 + z * 0.1);
  const spawn = { x: 2, z: 1, yaw: 0.4 };
  const { gateway, arrival } = placeReturnGateway(ctx, spawn);
  const bx = spawn.x - Math.sin(spawn.yaw) * 4, bz = spawn.z - Math.cos(spawn.yaw) * 4;
  assert.ok(Math.hypot(gateway.x - bx, gateway.z - bz) <= 0.05);
  assert.ok(Math.abs(Math.atan2(Math.sin(gateway.yaw - spawn.yaw - Math.PI), Math.cos(gateway.yaw - spawn.yaw - Math.PI))) < 1e-6);
  assert.equal(gateway.to, 'hub');
  assert.equal(gateway.id, 'return');
  assert.deepEqual(arrival, spawn);
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 24; a++) for (const f of [0.3, 0.6, 1]) { const h = ctx.hf.baseHeightAt(gateway.x + Math.cos(a / 24 * 6.283) * 1.6 * f, gateway.z + Math.sin(a / 24 * 6.283) * 1.6 * f); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi - lo <= 0.05, `pad spread ${(hi - lo).toFixed(3)}`);
});

test('in a multiplayer room no barrier stands, whatever this player has unlocked', async () => {
  const { buildGateways } = await import('../../public/rc-crawler/src/world/gateways.js');
  const level = { hf: { heightAt: () => 0 }, gateways: [{ id: 'mud', to: 'mud', x: 0, z: 10, yaw: 0, width: 3.2 }], basecamp: null };
  const solo = buildGateways(level, {});
  assert.ok(solo.list[0].barrier.every((p) => p.enabled), 'locked solo: barrier stands');
  const room = buildGateways(level, {}, { multiplayer: true });
  assert.ok(room.list[0].barrier.every((p) => !p.enabled && !p.mesh.visible), 'in a room: barrier down');
  solo.refresh({}, { multiplayer: true });
  assert.ok(solo.list[0].barrier.every((p) => !p.enabled), 'joining a room lowers it');
  solo.refresh({}, { multiplayer: false });
  assert.ok(solo.list[0].barrier.every((p) => p.enabled), 'leaving the room raises it again');
});
