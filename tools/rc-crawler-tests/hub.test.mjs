import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import { LevelContext } from '../../public/rc-crawler/src/levels/levelBuilder.js';
import { hub } from '../../public/rc-crawler/src/levels/hub.js';

let ctx, L;
before(() => { ctx = new LevelContext(hub, 'low'); L = hub.build(ctx); });
const H = (x, z) => ctx.hf.baseHeightAt(x, z);
const spread = (x, z, r) => { let lo = Infinity, hi = -Infinity; for (let a = 0; a < 24; a++) for (const f of [0.33, 0.66, 1]) { const h = H(x + Math.cos(a / 24 * 6.283) * r * f, z + Math.sin(a / 24 * 6.283) * r * f); lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };

test('six gateways, one per terrain, in spoke order', () => {
  assert.deepEqual(L.gateways.map((g) => g.to), ['desert', 'forest', 'mud', 'canyon', 'creek', 'ultimate']);
  for (const g of L.gateways) assert.equal(g.width, 3.2);
});

test('every gateway stands on a level pad', () => {
  for (const g of L.gateways) assert.ok(spread(g.x, g.z, 1.6) <= 0.12, `${g.to} pad spread ${spread(g.x, g.z, 1.6).toFixed(3)}`);
});

test('every spoke from basecamp to its gateway is drivable', () => {
  // the spokes are the first six paths, in gateway order; sample each along its own centreline
  L.gateways.forEach((g, i) => {
    const pts = ctx.paths[i].pts.filter((p) => Math.hypot(p.x, p.z) >= 9 && Math.hypot(p.x - g.x, p.z - g.z) >= 0.5);
    let worst = 0;
    for (let k = 1; k < pts.length; k++) {
      const run = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
      worst = Math.max(worst, Math.abs(H(pts[k].x, pts[k].z) - H(pts[k - 1].x, pts[k - 1].z)) / run);
    }
    assert.ok(worst <= 0.45, `${g.to} spoke grade ${worst.toFixed(2)}`);
  });
});

test('each arrival is inside its gateway and faces basecamp', () => {
  for (const g of L.gateways) {
    const a = L.arrivals[g.to];
    assert.ok(Math.hypot(a.x - g.x, a.z - g.z) >= 5, `${g.to} arrival too close`);
    const toCamp = Math.atan2(-a.x, -a.z);
    const diff = Math.abs(Math.atan2(Math.sin(a.yaw - toCamp), Math.cos(a.yaw - toCamp)));
    assert.ok(diff <= 10 / 57.3, `${g.to} arrival faces ${(diff * 57.3).toFixed(1)} deg off basecamp`);
  }
});

test('basecamp is flat', () => {
  assert.ok(spread(L.basecamp.x, L.basecamp.z, 8) <= 0.15, `basecamp spread ${spread(0, 0, 8).toFixed(3)}`);
});

test('activities keep clear of basecamp and the gateway pads', async () => {
  const { buildActivities } = await import('../../public/rc-crawler/src/levels/activities.js');
  const { TrailPath } = await import('../../public/rc-crawler/src/levels/levelBuilder.js');
  const c2 = new LevelContext(hub, 'low'); const L2 = hub.build(c2);
  const acts = buildActivities(c2, hub, L2, TrailPath);
  assert.ok(acts.sites.length >= 3, `only ${acts.sites.length} hub activities fit`);
  for (const s of acts.sites) {
    assert.ok(Math.hypot(s.cx - L2.basecamp.x, s.cz - L2.basecamp.z) - s.R >= L2.basecamp.r + 3, `${s.id} overlaps basecamp`);
    for (const g of L2.gateways) assert.ok(Math.hypot(s.cx - g.x, s.cz - g.z) - s.R >= 7, `${s.id} overlaps the ${g.to} gateway`);
  }
});
