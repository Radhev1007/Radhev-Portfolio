import { test } from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import { needleStep } from '../../public/rc-crawler/src/ui/ui.js';

test('a needle swings to the reading and settles, with a slight overshoot like a real gauge', () => {
  const n = { v: 0, w: 0 }; let peak = 0, t = 0;
  for (; t < 1.5; t += 1 / 60) { needleStep(n, 1, 1 / 60); peak = Math.max(peak, n.v); }
  assert.ok(Math.abs(n.v - 1) < 0.005, `settled at ${n.v}`);
  assert.ok(peak > 1.0 && peak < 1.06, `overshoot ${peak}`);
  const m = { v: 0, w: 0 }; for (let i = 0; i < 6; i++) needleStep(m, 1, 1 / 60);
  assert.ok(m.v > 0.15 && m.v < 0.9, `after 0.1 s it is on its way: ${m.v}`);
});

test('a long frame (tab in the background) does not fling the needle', () => {
  const n = { v: 0, w: 0 }; needleStep(n, 1, 2);
  assert.ok(Number.isFinite(n.v) && n.v >= 0 && n.v <= 1.06, `${n.v}`);
});
