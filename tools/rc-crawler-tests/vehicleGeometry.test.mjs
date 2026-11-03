import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Heightfield } from '../../public/rc-crawler/src/terrain/heightfield.js';
import { CrawlerPhysics } from '../../public/rc-crawler/src/physics/vehicle.js';
import { vehicleGeometry } from '../../public/rc-crawler/src/vehicles/geometry.js';

const flat = () => { const hf = new Heightfield(40, 0.5); hf.finalizePhysics(); return hf; };
const settle = (phys) => { phys.placeAt(0, 0, 0); for (let i = 0; i < 240; i++) phys.update(1 / 60, { throttle: 0, steer: 0, handbrake: true }); return phys; };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('the SCX30 keeps the RC geometry', () => {
  assert.equal(vehicleGeometry('scx30'), null);
  assert.equal(vehicleGeometry('bronco'), null);
});

test('the Willys takes its own track, tyre size and belly height from the model', () => {
  const g = vehicleGeometry('willys');
  near(g.halfTrack, 0.4224, 0.002, 'half track');
  near(g.wheelRadius, 0.2331, 0.002, 'tyre radius');
  near(g.wheelHalfWidth, 0.0903, 0.002, 'tyre half width');
  near(g.bellyY, -0.112, 0.003, 'belly');
});

test('a Willys stands on its own tyres: wheels where the model has them, the model\'s ground clearance', () => {
  const phys = new CrawlerPhysics(flat());
  phys.setGeometry(vehicleGeometry('willys'));
  assert.deepEqual(phys.wheels.map((w) => +w.mx.toFixed(4)), [0.4224, -0.4224, 0.4224, -0.4224]);
  settle(phys);
  const g = vehicleGeometry('willys');
  const belly = phys.pos.y + g.bellyY;   // flat ground at 0, the truck level
  // the model's clearance under the tub (0.2215 at this scale) less the tyres' squash under load
  near(belly, 0.2215, 0.035, 'ground clearance');
  assert.ok(Math.abs(new THREE.Vector3(0, 1, 0).applyQuaternion(phys.q).y - 1) < 0.01, 'level');
});

test('the Willys sits higher than the SCX30 on its bigger tyres', () => {
  const rc = settle(new CrawlerPhysics(flat()));
  const w = new CrawlerPhysics(flat()); w.setGeometry(vehicleGeometry('willys')); settle(w);
  near(w.pos.y - rc.pos.y, 0.2331 - 0.2, 0.012, 'ride height difference');
  // and back again
  w.setGeometry(null); settle(w);
  near(w.pos.y, rc.pos.y, 0.003, 'back on the RC geometry');
});
