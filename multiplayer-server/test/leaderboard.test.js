// Leaderboards: best server-timed result per player per course, top 10, kept across rooms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Leaderboards, parseParts } from '../src/leaderboard.js';

test('keeps each player\'s best, sorted, top 10 only', () => {
  const b = new Leaderboards(null);
  b.record('forest:mis-race:race', { guest: 'a', name: 'Ann', t: 50000, vehicle: 'willys', stock: true });
  b.record('forest:mis-race:race', { guest: 'a', name: 'Ann', t: 60000, vehicle: 'willys', stock: true });   // slower: ignored
  b.record('forest:mis-race:race', { guest: 'b', name: 'Bo', t: 40000, vehicle: 'scx30', stock: false });
  assert.deepEqual(b.top('forest:mis-race:race').map((e) => [e.name, e.t]), [['Bo', 40000], ['Ann', 50000]]);
  b.record('forest:mis-race:race', { guest: 'a', name: 'Ann', t: 30000, vehicle: 'willys', stock: true });   // faster: replaces
  assert.deepEqual(b.top('forest:mis-race:race')[0], { name: 'Ann', t: 30000, vehicle: 'willys', stock: true, at: b.top('forest:mis-race:race')[0].at });
  for (let i = 0; i < 15; i++) b.record('k', { guest: 'g' + i, name: 'P' + i, t: 1000 + i, vehicle: 'scx30', stock: true });
  assert.equal(b.top('k').length, 10);
  assert.equal(b.top('k')[9].t, 1009);
});

test('rejects nonsense and survives a restart (saved to disk)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rcboard-')), file = join(dir, 'boards.json');
  const a = new Leaderboards(file);
  assert.equal(a.record('k', { guest: 'x', name: 'X', t: -5 }), false);
  assert.equal(a.record('k', { guest: 'x', name: 'X', t: NaN }), false);
  assert.equal(a.record('k', { guest: 'x', name: 'X', t: 12345, vehicle: 'scx30', stock: true }), true);
  a.flush();
  assert.ok(readFileSync(file, 'utf8').includes('12345'));
  assert.equal(new Leaderboards(file).top('k')[0].t, 12345);
});

test('garage parts codes are checked against the parts that exist', () => {
  assert.deepEqual(parseParts('mt.firm.t27.s3.sport.wide.lightbar+rack'), { code: 'mt.firm.t27.s3.sport.wide.lightbar+rack', stock: false });
  assert.deepEqual(parseParts('at.stock.t35.s2.stock.stock.lightbar+bumper'), { code: 'at.stock.t35.s2.stock.stock.lightbar+bumper', stock: true }, 'looks-only accessories are still stock');
  assert.equal(parseParts('nitro.stock.t35.s2.stock.stock.').code, '', 'unknown part');
  assert.equal(parseParts('x'.repeat(500)).code, '');
  assert.equal(parseParts(42).code, '');
});
