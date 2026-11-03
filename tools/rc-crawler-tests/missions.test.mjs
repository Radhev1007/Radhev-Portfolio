import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import { LevelContext, TrailPath } from '../../public/rc-crawler/src/levels/levelBuilder.js';
import { LEVELS } from '../../public/rc-crawler/src/levels/levels.js';
import { addTrailObstacles } from '../../public/rc-crawler/src/levels/trailObstacles.js';
import { buildActivities, Props } from '../../public/rc-crawler/src/levels/activities.js';
import { buildMissions } from '../../public/rc-crawler/src/levels/missions.js';
import { ringFor } from '../../public/rc-crawler/src/world/challengeRings.js';

const TERRAINS = LEVELS.filter((d) => d.id !== 'hub');
const built = {};
before(() => {
  for (const def of TERRAINS) {
    const ctx = new LevelContext(def, 'low'); const layout = def.build(ctx); ctx.props = new Props();
    addTrailObstacles(ctx, def, layout, TrailPath);
    const acts = buildActivities(ctx, def, layout, TrailPath);
    const others = [...(layout.challenges || []), ...acts.challenges];
    built[def.id] = { ctx, layout, others, missions: buildMissions(ctx, def, layout, others) };
  }
});
const near = (path, g) => Math.min(...path.pts.map((q) => Math.hypot(q.x - g.x, q.z - g.z)));

test('every terrain gets missions: a checkpoint race and a recovery, and a hill climb where the trail climbs', () => {
  for (const def of TERRAINS) {
    const kinds = built[def.id].missions.map((m) => m.mission);
    assert.ok(kinds.includes('race') && kinds.includes('recovery'), `${def.id}: ${kinds}`);
  }
  assert.ok(TERRAINS.filter((d) => built[d.id].missions.some((m) => m.mission === 'climb')).length >= 3, 'hill climbs on at least three terrains');
});

test('missions run along the trail, with a par time, a tier and a clear name', () => {
  for (const def of TERRAINS) for (const m of built[def.id].missions) {
    const { path } = built[def.id].layout;
    for (const g of m.gates) assert.ok(near(path, g) < 0.6, `${def.id} ${m.id}: a gate ${near(path, g).toFixed(2)} m off the trail`);
    assert.ok(m.par > 10 && ['Beginner', 'Intermediate', 'Expert'].includes(m.tier) && m.name && m.desc, `${def.id} ${m.id}`);
    assert.ok(m.gates.every((g) => g.width >= 3), 'gates span the trail');
  }
});

test('a hill climb starts at the bottom and finishes well above it', () => {
  for (const def of TERRAINS) for (const m of built[def.id].missions.filter((x) => x.mission === 'climb')) {
    const hf = built[def.id].ctx.hf, h = (g) => hf.baseHeightAt(g.x, g.z);
    assert.ok(h(m.gates[m.gates.length - 1]) - h(m.gates[0]) >= 1.5, `${def.id}: climbs ${(h(m.gates.at(-1)) - h(m.gates[0])).toFixed(2)} m`);
  }
});

test('a checkpoint race has checkpoints about every 20 m', () => {
  for (const def of TERRAINS) {
    const m = built[def.id].missions.find((x) => x.mission === 'race');
    assert.ok(m.gates.length >= 5, `${def.id}: ${m.gates.length} gates`);
    for (let i = 1; i < m.gates.length; i++) { const d = Math.hypot(m.gates[i].x - m.gates[i - 1].x, m.gates[i].z - m.gates[i - 1].z); assert.ok(d > 8 && d < 24, `${def.id}: checkpoints ${d.toFixed(1)} m apart`); }
  }
});

test('a recovery goes out to a stranded crawler beside the trail and back to the start', () => {
  for (const def of TERRAINS) {
    const { ctx, layout, missions } = built[def.id], m = missions.find((x) => x.mission === 'recovery');
    const s = ctx.markers.find((k) => k.type === 'stranded' && k.id === m.id);
    assert.ok(s, `${def.id}: no stranded truck`);
    const off = near(layout.path, s);
    assert.ok(off > 1.2 && off < 3.5, `${def.id}: stranded ${off.toFixed(2)} m from the trail`);
    const g = m.gates[1];
    assert.ok(Math.hypot(g.x - s.x, g.z - s.z) < 4, 'the turn-round gate is beside the stranded truck');
    assert.ok(Math.hypot(m.gates[0].x - m.gates.at(-1).x, m.gates[0].z - m.gates.at(-1).z) < 0.01, 'finish where it started');
  }
});

test('mission start rings never overlap each other or the other challenges\' rings', () => {
  for (const def of TERRAINS) {
    // (the level's own challenges may share a start: the Park Run chains the sections from the first one's gate)
    const mine = built[def.id].missions.map(ringFor), rings = [...built[def.id].others.filter((c) => c.gates?.length).map(ringFor), ...mine];
    for (let i = 0; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) {
      if (!mine.includes(rings[i]) && !mine.includes(rings[j])) continue;
      const d = Math.hypot(rings[i].x - rings[j].x, rings[i].z - rings[j].z);
      assert.ok(d > rings[i].r + rings[j].r, `${def.id}: rings ${rings[i].id} and ${rings[j].id} overlap`);
    }
  }
});
