import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countMedals, medalsIn, isUnlocked, newlyUnlocked, recordAvailable, availableIn, needFor } from '../../public/rc-crawler/src/world/progress.js';

const best = { 'hub:a#medal': 'gold', 'hub:a': 31, 'desert:b#medal': 'bronze', 'desert:c#medal': null };
const medals = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`hub:c${i}#medal`, 'bronze']));
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('countMedals counts each medalled challenge once, ignoring times and empty medals', () => {
  assert.equal(countMedals(best), 2);
  assert.equal(countMedals({}), 0);
});

test('medalsIn counts one level', () => {
  assert.equal(medalsIn(best, 'desert'), 1);
  assert.equal(medalsIn(best, 'mud'), 0);
});

test('unlock thresholds', () => {
  assert.equal(isUnlocked('mud', medals(2)), false);
  assert.equal(isUnlocked('mud', medals(3)), true);
  assert.equal(isUnlocked('forest', {}), true);
  assert.equal(isUnlocked('hub', {}), true);
  assert.equal(isUnlocked('ultimate', medals(14)), false);
  assert.equal(isUnlocked('ultimate', medals(15)), true);
  assert.equal(needFor('canyon'), 6);
  assert.equal(needFor('nowhere'), 0);
});

test('newlyUnlocked lists levels crossing their threshold', () => {
  assert.deepEqual(newlyUnlocked(medals(5), medals(6)), ['canyon']);
  assert.deepEqual(newlyUnlocked(medals(2), medals(10)), ['mud', 'canyon', 'creek']);
  assert.deepEqual(newlyUnlocked(medals(6), medals(6)), []);
});

test('available challenge counts are cached per level', () => {
  const s = memStore();
  recordAvailable('canyon', 10, s);
  assert.equal(availableIn('canyon', s), 10);
  assert.equal(availableIn('mud', s), null);
});

test('a storage that throws never breaks progress', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => recordAvailable('canyon', 10, bad));
  assert.equal(availableIn('canyon', bad), null);
  assert.equal(availableIn('canyon', undefined), null);
});

test('a browser that throws on reading localStorage itself never breaks progress', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.doesNotThrow(() => recordAvailable('canyon', 10));
    assert.equal(availableIn('canyon'), null);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});
