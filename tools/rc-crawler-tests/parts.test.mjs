import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heightfield, SURF } from '../../public/rc-crawler/src/terrain/heightfield.js';
import { CrawlerPhysics, GEARS } from '../../public/rc-crawler/src/physics/vehicle.js';
import { PARTS, STOCK, partsSetup, partStats, partsCode, partsFromCode } from '../../public/rc-crawler/src/vehicles/parts.js';
import { parseParts } from '../../multiplayer-server/src/leaderboard.js';

const flat = (surf = SURF.DIRT, size = 60) => { const hf = new Heightfield(size, 0.5); if (surf !== SURF.DIRT) hf.surf.fill(surf); hf.finalizePhysics(); return hf; };
const truck = (parts, surf, size) => { const p = new CrawlerPhysics(flat(surf, size)); p.setSetup(partsSetup(parts)); p.placeAt(0, 0, 0); for (let i = 0; i < 90; i++) p.update(1 / 60, { throttle: 0, steer: 0, handbrake: true }); return p; };
const drive = (p, s, throttle = 1) => { for (let i = 0; i < s * 60; i++) p.update(1 / 60, { throttle, steer: 0, handbrake: false }); return p; };
const fit = (o) => ({ ...STOCK, ...o });

test('every part category has a stock option first, and every option a name and what it does', () => {
  for (const [cat, c] of Object.entries(PARTS)) {
    assert.ok(c.name && c.options.length >= 2, cat);
    if (!c.multi) assert.equal(c.options[0].id, STOCK[cat], `${cat}: stock first`);
    for (const o of c.options) assert.ok(o.id && o.name && o.desc, `${cat}.${o.id}`);
  }
});

test('stock parts drive exactly like the truck always has', () => {
  const a = new CrawlerPhysics(flat()); a.placeAt(0, 0, 0);
  const b = new CrawlerPhysics(flat()); b.setSetup(partsSetup(STOCK)); b.placeAt(0, 0, 0);
  for (const p of [a, b]) { p.gear = GEARS.HIGH; drive(p, 3, 0.8); }
  assert.ok(a.pos.distanceTo(b.pos) < 1e-9 && Math.abs(a.battery - b.battery) < 1e-12, `${a.pos.toArray()} vs ${b.pos.toArray()}`);
});

test('shocks: firm ones sag less under the truck\'s weight than soft ones', () => {
  const soft = truck(fit({ shocks: 'soft' })), firm = truck(fit({ shocks: 'firm' }));
  assert.ok(firm.pos.y > soft.pos.y + 0.004, `${firm.pos.y} vs ${soft.pos.y}`);
});

test('motor and battery: a 27T is faster, a 45T slower; a 3S pack faster still; a 5000 mAh pack lasts longer', () => {
  // (a big field, so the faster trucks do not reach its edge)
  const top = (parts) => { const p = truck(fit(parts), SURF.DIRT, 240); p.gear = GEARS.HIGH; drive(p, 4); return Math.abs(p.stats.speed); };
  const stock = top({}), fast = top({ motor: 't27' }), slow = top({ motor: 't45' }), threeS = top({ battery: 's3' });
  assert.ok(fast > stock * 1.1 && slow < stock * 0.92 && threeS > stock * 1.08, `${fast} ${stock} ${slow} ${threeS}`);
  const runtime = (parts) => { const p = truck(fit(parts)); drive(p, 20); return p.battery; };
  assert.ok(1 - runtime({ battery: 'mah5000' }) < (1 - runtime({})) * 0.6, 'the big pack drains slower');
});

test('tyres: mud terrains grip more in mud, the sticky compound more on rock', () => {
  const s = (t) => partsSetup(fit({ tyres: t })).compound;
  assert.ok(s('mt')[SURF.MUD] > 1 && s('mt')[SURF.ROCK] < 1);
  assert.ok(s('sticky')[SURF.ROCK] > 1 && s('sticky')[SURF.MUD] < 1);
  // in the physics: on a mud field the mud terrains pull away faster
  const run = (t) => { const p = truck(fit({ tyres: t }), SURF.MUD); p.gear = GEARS.HIGH; drive(p, 2); return p.pos.z; };
  assert.ok(run('mt') > run('at') + 0.02, `${run('mt')} vs ${run('at')}`);
});

test('wheel offset widens or narrows the track; a roof rack raises the centre of mass; ESC sets throttle response', () => {
  const wide = truck(fit({ offset: 'wide' })), narrow = truck(fit({ offset: 'narrow' }));
  assert.ok(wide.wheels[0].mx > 0.36 && narrow.wheels[0].mx < 0.33, `${wide.wheels[0].mx} ${narrow.wheels[0].mx}`);
  const rack = partsSetup(fit({ acc: ['rack'] })), plain = partsSetup(STOCK);
  assert.ok(rack.comLift > plain.comLift);
  const resp = (esc) => { const p = truck(fit({ esc })); p.update(0.1, { throttle: 1, steer: 0, handbrake: false }); return p.throttle; };
  assert.ok(resp('sport') > resp('stock') && resp('crawl') < resp('stock'));
});

test('the garage stats read the parts: stock is the middle of every bar', () => {
  const st = partStats(STOCK);
  for (const v of Object.values(st)) assert.ok(Math.abs(v - 0.5) < 1e-9, JSON.stringify(st));
  const mod = partStats(fit({ motor: 't27', battery: 'mah5000', shocks: 'firm' }));
  assert.ok(mod.speed > 0.5 && mod.torque < 0.5 && mod.runtime > 0.5 && mod.stability > 0.5);
});

test('parts travel to other players as a code the server accepts, and come back the same', () => {
  const mine = fit({ tyres: 'mt', motor: 't27', offset: 'wide', acc: ['lightbar', 'rack'] });
  const code = partsCode(mine);
  assert.equal(parseParts(code).code, code, 'the server accepts it');
  assert.equal(parseParts(code).stock, false);
  assert.deepEqual(partsFromCode(code), mine);
  assert.equal(parseParts(partsCode(STOCK)).stock, true);
  assert.deepEqual(partsFromCode(''), { ...STOCK, acc: [] }, 'no code: stock');
  // the two catalogues match: every option the game offers is one the server knows
  for (const [cat, c] of Object.entries(PARTS)) for (const o of c.options) {
    const p = cat === 'acc' ? fit({ acc: [o.id] }) : fit({ [cat]: o.id });
    assert.notEqual(parseParts(partsCode(p)).code, '', `${cat}.${o.id} unknown to the server`);
  }
});
