import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import { LevelContext, TrailPath } from '../../public/rc-crawler/src/levels/levelBuilder.js';
import { LEVELS } from '../../public/rc-crawler/src/levels/levels.js';
import { addTrailObstacles, RECIPES, takenStretches } from '../../public/rc-crawler/src/levels/trailObstacles.js';
import { Props } from '../../public/rc-crawler/src/levels/activities.js';

const TERRAINS = LEVELS.filter((d) => d.id !== 'hub');
const built = {};
before(() => {
  for (const def of TERRAINS) {
    const ctx = new LevelContext(def, 'low'); const layout = def.build(ctx); ctx.props = new Props();
    const before = takenStretches(ctx, layout.path, layout);   // what the level itself already put on the trail
    const levelWater = ctx.water.map((w) => ({ ...w }));
    const obs = addTrailObstacles(ctx, def, layout, TrailPath);
    // the physics ground, as buildLevel makes it: terrain, then rocks, logs and props stamped in
    const hf = ctx.hf; hf.finalizePhysics(); ctx.rocks.rasterize(hf);
    for (const g of ctx.logsPhys) hf.rasterize(g.attributes.position.array, g.index ? g.index.array : null, 6, 0.02);
    for (const pr of ctx.props.phys) hf.rasterize(pr.geo.attributes.position.array, pr.geo.index ? pr.geo.index.array : null, pr.surf, 0);
    built[def.id] = { ctx, layout, obs, before, levelWater };
  }
});

test('every terrain gets 20 to 30 trail obstacles', () => {
  for (const def of TERRAINS) { const n = built[def.id].obs.length; assert.ok(n >= 20 && n <= 30, `${def.id}: ${n}`); }
});

test('difficulty climbs 20 / 30 / 30 / 20 % along the trail', () => {
  for (const def of TERRAINS) {
    const { obs } = built[def.id], n = obs.length, c = [0, 0, 0, 0];
    obs.forEach((o, i) => { c[o.tier]++; if (i) assert.ok(o.tier >= obs[i - 1].tier && o.s > obs[i - 1].s, `${def.id}: out of order at ${i}`); });
    [0.2, 0.3, 0.3, 0.2].forEach((f, k) => assert.ok(Math.abs(c[k] - f * n) <= 1, `${def.id}: tier ${k} has ${c[k]} of ${n}`));
  }
});

test('obstacles run the whole trail, start to finish, with no long empty stretch', () => {
  for (const def of TERRAINS) {
    const { obs, layout, before } = built[def.id], L = layout.path.len, { taken, step } = before;
    assert.ok(obs[0].s < L * 0.25, `${def.id}: first at ${obs[0].s.toFixed(0)} m of ${L.toFixed(0)}`);
    assert.ok(obs[obs.length - 1].s > L * 0.75, `${def.id}: last at ${obs[obs.length - 1].s.toFixed(0)} m`);
    // empty = neither one of the level's own obstacles nor a new one
    let run = 0, worst = 0;
    for (let i = 0; i < taken.length; i++) {
      const s = i * step, mine = obs.some((o) => Math.abs(o.s - s) <= o.len / 2);
      run = taken[i] || mine ? 0 : run + step; worst = Math.max(worst, run);
    }
    assert.ok(worst < 12, `${def.id}: ${worst.toFixed(1)} m of empty trail`);
  }
});

test('every terrain has its own arrangement, never the same obstacle twice running', () => {
  const seqs = TERRAINS.map((d) => built[d.id].obs.map((o) => o.kind).join(','));
  assert.equal(new Set(seqs).size, seqs.length);
  for (const def of TERRAINS) {
    const obs = built[def.id].obs, uses = {};
    obs.forEach((o, i, a) => { if (i) assert.notEqual(o.kind, a[i - 1].kind, `${def.id} repeats ${o.kind}`); uses[o.kind] = (uses[o.kind] || 0) + 1; });
    for (const [k, n] of Object.entries(uses)) assert.ok(n <= 3, `${def.id} has ${n} x ${k}`);
    assert.ok(Object.keys(uses).length >= 9, `${def.id} uses only ${Object.keys(uses).length} kinds`);
  }
});

test("each terrain's obstacles match its identity", () => {
  const sig = { canyon: ['boulders', 'narrowPassage', 'rockClimb', 'cliffPath', 'boulderStep', 'vGap'], forest: ['log', 'logs', 'fallenTrunk', 'roots'], mud: ['mud', 'water', 'potholes'], desert: ['dunes', 'gravel', 'sharpEdge'], creek: ['water', 'slabs', 'boulders'], ultimate: ['rockGarden', 'articulation', 'multiLevel', 'vGap', 'offCamberRock'] };
  for (const def of TERRAINS) {
    const kinds = built[def.id].obs.map((o) => o.kind);
    const hits = kinds.filter((k) => sig[def.id].includes(k)).length;
    assert.ok(hits >= 4, `${def.id}: only ${hits} signature obstacles (${kinds.join(',')})`);
    assert.ok(kinds.every((k) => k in RECIPES[def.id]), `${def.id} uses a kind outside its mix`);
  }
});

test('the spawn and every challenge gate stay clear', () => {
  for (const def of TERRAINS) {
    const { obs, layout } = built[def.id];
    assert.ok(obs[0].s - obs[0].len / 2 >= 6, `${def.id}: obstacle at the spawn`);
    const gates = layout.challenges.flatMap((c) => c.gates);
    for (const o of obs) for (let al = -o.len / 2; al <= o.len / 2; al += 0.25) {
      const p = layout.path.offset(o.t, 0, al);
      for (const g of gates) assert.ok(Math.hypot(g.x - p.x, g.z - p.z) >= 1.5, `${def.id}: ${o.kind} on a challenge gate`);
    }
  }
});

test('rock, log and prop obstacles are solid in the physics ground', () => {
  const solid = new Set(['boulders', 'sharpEdge', 'rockGarden', 'narrowPassage', 'steps', 'log', 'logs', 'fallenTrunk', 'concrete', 'slabs', 'tires', 'beam', 'platform', 'vGap', 'boulderStep', 'multiLevel', 'offCamberRock']);
  for (const def of TERRAINS) {
    const { ctx, obs, layout } = built[def.id], hf = ctx.hf;
    for (const o of obs) {
      if (!solid.has(o.kind)) continue;
      let lift = 0;
      for (let al = -o.len / 2; al <= o.len / 2; al += 0.1) for (let lat = -1.6; lat <= 1.6; lat += 0.1) {
        const q = layout.path.offset(o.t, lat, al);
        lift = Math.max(lift, hf.heightAt(q.x, q.z) - hf.baseHeightAt(q.x, q.z));
      }
      assert.ok(lift > 0.05, `${def.id}: ${o.kind} at ${o.s.toFixed(0)} m is not solid (${lift.toFixed(3)} m)`);
    }
  }
});

test("no obstacle is hidden under water: the level's own or a new crossing", () => {
  for (const def of TERRAINS) {
    const { ctx, obs, layout } = built[def.id];
    for (const o of obs) {
      if (o.kind === 'water') continue;
      for (let al = -o.len / 2; al <= o.len / 2; al += 0.5) {
        const p = layout.path.offset(o.t, 0, al), h = ctx.hf.baseHeightAt(p.x, p.z);
        const under = ctx.water.some((w) => p.x > w.x0 && p.x < w.x1 && p.z > w.z0 && p.z < w.z1 && h < w.y);
        assert.ok(!under, `${def.id}: ${o.kind} at ${o.s.toFixed(0)} m is under water`);
      }
    }
  }
});

// ---------------------------------------------------------------- phase 2: bridges, ruts, cones, rope barriers
import { SURF } from '../../public/rc-crawler/src/terrain/heightfield.js';
const placed = (kind) => TERRAINS.flatMap((d) => built[d.id].obs.filter((o) => o.kind === kind).map((o) => ({ ...o, def: d.id })));

test('plank bridges and deep ruts appear on the trails', () => {
  const decks = placed('bridge').filter((o) => { const { ctx, layout } = built[o.def], P = layout.path.at(o.t); return ctx.hf.surfaceAt(P.x, P.z) === SURF.WOOD; });
  assert.ok(decks.length >= 3, `bridges built: ${decks.length} of ${placed('bridge').length}`);
  assert.ok(placed('ruts').length >= 2, `ruts: ${placed('ruts').length}`);
});

test('a bridge spans a ditch on a wooden deck you can drive onto and off', () => {
  for (const o of placed('bridge')) {
    const { ctx, layout } = built[o.def], hf = ctx.hf, path = layout.path, P = path.at(o.t), T = path.tangent(o.t);
    const at = (al) => ({ x: P.x + T.x * al, z: P.z + T.z * al });
    const mid = at(0);
    // the deck is wood and stands well above the ditch it crosses (on a steep stretch the spot is a mud pit)
    if (hf.surfaceAt(mid.x, mid.z) !== SURF.WOOD) { assert.ok(ctx.mudW.some((v) => v > 0), `${o.def}: neither bridge nor mud`); continue; }
    assert.ok(hf.heightAt(mid.x, mid.z) - hf.baseHeightAt(mid.x, mid.z) > 0.2, `${o.def}: no ditch under the deck`);
    // driving along it there is no step a tyre cannot roll up (ramps at both ends)
    if (hf.surfaceAt(mid.x, mid.z) !== SURF.WOOD) continue;
    const span = 3.4 / 2 + 0.85;   // deck and ramps
    let worst = 0, prev = hf.heightAt(at(-span).x, at(-span).z);
    for (let al = -span; al <= span; al += 0.05) { const q = at(al), h = hf.heightAt(q.x, q.z); worst = Math.max(worst, Math.abs(h - prev)); prev = h; }
    assert.ok(worst < 0.09, `${o.def}: a ${worst.toFixed(2)} m step along the bridge`);
  }
});

test('ruts are two grooves at the truck\'s track width', () => {
  for (const o of placed('ruts')) {
    const { ctx, layout } = built[o.def], hf = ctx.hf, path = layout.path, P = path.at(o.t), N = path.normal(o.t);
    const h = (lat) => hf.heightAt(P.x + N.x * lat, P.z + N.z * lat);
    assert.ok(h(0) - h(0.38) > 0.04 && h(0) - h(-0.38) > 0.04, `${o.def}: ruts ${(h(0) - h(0.38)).toFixed(3)} ${(h(0) - h(-0.38)).toFixed(3)}`);
  }
});

test('cones and rope barriers stand beside the trail, off the driving line; each rope joins two posts', () => {
  for (const def of TERRAINS) {
    const { ctx, layout } = built[def.id], path = layout.path, ms = ctx.markers;
    const cones = ms.filter((m) => m.type === 'cone'), posts = ms.filter((m) => m.type === 'ropePost');
    assert.ok(cones.length >= 10, `${def.id}: ${cones.length} cones`);
    const off = (m) => Math.min(...path.pts.map((q) => Math.hypot(q.x - m.x, q.z - m.z)));
    for (const m of [...cones, ...posts.filter((p) => !p.bridge)]) assert.ok(off(m) > 1.4, `${def.id}: a ${m.type} ${off(m).toFixed(2)} m from the line`);
    const ids = new Set(posts.map((p) => p.id));
    for (const p of posts) if (p.ropeTo != null) assert.ok(ids.has(p.ropeTo), `${def.id}: rope to a missing post`);
  }
  assert.ok(TERRAINS.some((d) => built[d.id].ctx.markers.some((m) => m.type === 'ropePost')), 'no rope barriers anywhere');
});
