// End-to-end room tests: a real server process and real Colyseus clients over WebSockets.
//   npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';
import { encodeMove, decodeSnapshot, FLAG } from '../shared/codec.js';

const PORT = 2599;
const URL = `ws://127.0.0.1:${PORT}`;
let proc;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gid = () => 'test-' + Math.random().toString(36).slice(2, 12);
const pose = (x, z, extra = {}) => ({ x, y: 1, z, qx: 0, qy: 0, qz: 0, qw: 1, vx: 0, vy: 0, vz: 0, steer: 0, throttle: 0, hub: [-0.1, -0.1, -0.1, -0.1], flags: 0, ...extra });

before(async () => {
  proc = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), RECONNECT_SECONDS: '3', LIVEKIT_URL: '', LIVEKIT_API_KEY: '', LIVEKIT_API_SECRET: '' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return; } catch { /* starting */ } await sleep(100); }
  throw new Error('server did not start');
});
after(() => proc?.kill());

test('create, join by code, invalid code, duplicate player, capacity 20', async () => {
  const host = await new Client(URL).create('rc', { name: 'Host', guestId: gid() });
  const code = host.roomId;
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/);

  await assert.rejects(new Client(URL).joinById('ZZZZZ', { name: 'X', guestId: gid() }), 'unknown code is rejected');

  const dupId = gid();
  const a = await new Client(URL).joinById(code, { name: 'Host', guestId: dupId });
  await assert.rejects(new Client(URL).joinById(code, { name: 'Again', guestId: dupId }), /already in this room/);
  await sleep(200);
  const names = [...host.state.players.values()].map((p) => p.name).sort();
  assert.deepEqual(names, ['Host', 'Host 2'], 'duplicate display names get a suffix');

  const rest = [];
  for (let i = 0; i < 18; i++) rest.push(await new Client(URL).joinById(code, { name: `P${i}`, guestId: gid() }));
  await sleep(300);
  assert.equal(host.state.players.size, 20);
  await assert.rejects(new Client(URL).joinById(code, { name: 'TwentyFirst', guestId: gid() }), 'the 21st player is rejected');
  const slots = [...host.state.players.values()].map((p) => p.slot).sort((x, y) => x - y);
  assert.deepEqual(slots, [...Array(20).keys()]);

  for (const r of [a, ...rest]) await r.leave();
  await host.leave();
});

test('movement is relayed in snapshots; teleports are rejected and corrected', async () => {
  const a = await new Client(URL).create('rc', { name: 'A', guestId: gid() });
  const b = await new Client(URL).joinById(a.roomId, { name: 'B', guestId: gid() });
  await sleep(200);
  const slotA = a.state.players.get(a.sessionId).slot;
  let seen = null;
  b.onMessage('s', (bytes) => decodeSnapshot(bytes, (slot, s) => { if (slot === slotA) seen = { ...s }; }));
  let corrected = null;
  a.onMessage('correct', (m) => (corrected = m));
  a.onMessage('pong', () => {});
  let seq = 0;
  a.sendBytes('m', encodeMove(seq++, pose(10, 5, { vx: 1.5, steer: 0.3, throttle: 0.5 })));
  await sleep(250);
  assert.ok(seen, 'B received A in a snapshot');
  assert.ok(Math.abs(seen.x - 10) < 1e-3 && Math.abs(seen.z - 5) < 1e-3);
  assert.ok(Math.abs(seen.vx - 1.5) < 0.02 && Math.abs(seen.steer - 0.3) < 0.01 && Math.abs(seen.throttle - 0.5) < 0.01);

  // 40 m in one update is impossible: dropped, and after a few the client is told where it really is
  for (let i = 0; i < 4; i++) { a.sendBytes('m', encodeMove(seq++, pose(50, 5))); await sleep(30); }
  await sleep(200);
  assert.ok(Math.abs(seen.x - 10) < 1e-3, 'teleport not relayed');
  assert.ok(corrected && Math.abs(corrected.x - 10) < 1e-3, 'client corrected');
  // ...but a recovery (flagged) may move the truck
  a.sendBytes('m', encodeMove(seq++, pose(30, -20, { flags: FLAG.RECOVER })));
  await sleep(250);
  assert.ok(Math.abs(seen.x - 30) < 1e-3, 'flagged recovery accepted');
  // garbage is ignored
  a.sendBytes('m', new Uint8Array([1, 2, 3]));
  const nan = encodeMove(seq++, pose(NaN, 0)); a.sendBytes('m', nan);
  await sleep(150);
  assert.ok(Math.abs(seen.x - 30) < 1e-3);
  await a.leave(); await b.leave();
});

test('host passes on, reconnection keeps the seat, ready/start rules', async () => {
  const host = await new Client(URL).create('rc', { name: 'H', guestId: gid() });
  const g = await new Client(URL).joinById(host.roomId, { name: 'G', guestId: gid() });
  await sleep(200);
  let notice = null; host.onMessage('notice', (m) => (notice = m));
  host.send('config', { mode: 'free' });
  host.send('start', {});
  await sleep(200);
  assert.match(notice?.text || '', /ready/, 'cannot start until everyone is ready');
  g.send('ready', { ready: true });
  await sleep(150);
  host.send('start', {});
  await sleep(250);
  assert.equal(host.state.phase, 'countdown');

  // unexpected drop then reconnect within the window: same seat
  const token = g.reconnectionToken, sid = g.sessionId;
  g.connection.close(4100);            // an abnormal drop (4000 would mean "left on purpose")
  await sleep(300);
  assert.equal(host.state.players.get(sid).connected, false);
  const g2 = await new Client(URL).reconnect(token);
  await sleep(200);
  assert.equal(g2.sessionId, sid);
  assert.equal(host.state.players.get(sid).connected, true);

  // host leaves for good: the other player becomes host
  await host.leave();
  await sleep(250);
  assert.equal(g2.state.players.get(sid).host, true);
  await g2.leave();
});

test('without LiveKit, voice falls back to direct voice with STUN servers', async () => {
  const a = await new Client(URL).create('rc', { name: 'V', guestId: gid() });
  const reply = await new Promise((res) => { a.onMessage('voiceToken', res); a.send('voiceToken'); });
  assert.equal(reply.p2p, true);
  assert.ok(reply.ice[0].urls.some((u) => u.startsWith('stun:')));
  assert.equal(reply.token, undefined);
  await a.leave();
});

test('direct-voice signalling is relayed only between players on direct voice', async () => {
  const a = await new Client(URL).create('rc', { name: 'A', guestId: gid() });
  const b = await new Client(URL).joinById(a.roomId, { name: 'B', guestId: gid() });
  const got = []; b.onMessage('rtc', (m) => got.push(m)); a.onMessage('*', () => {}); b.onMessage('*', () => {});
  await sleep(150);
  a.send('rtc', { to: b.sessionId, kind: 'offer', sdp: 'v=0' });           // neither is on direct voice yet
  await sleep(150);
  assert.equal(got.length, 0);
  a.send('voice', { on: true, via: 'p2p' }); b.send('voice', { on: true, via: 'p2p' });
  await sleep(250);
  a.send('rtc', { to: b.sessionId, kind: 'offer', sdp: 'v=0' });
  a.send('rtc', { to: b.sessionId, kind: 'ice', cand: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } });
  a.send('rtc', { to: b.sessionId, kind: 'evil', sdp: 'x' });
  a.send('rtc', { to: b.sessionId, kind: 'offer', sdp: 'x'.repeat(30500) });     // over the relay's 30 KB limit (under the 32 KB frame limit)
  await sleep(250);
  assert.deepEqual(got.map((m) => m.kind), ['offer', 'ice']);
  assert.equal(got[0].from, a.sessionId);
  await a.leave(); await b.leave();
});

test('relayed voice audio reaches only the targeted players on direct voice', async () => {
  const a = await new Client(URL).create('rc', { name: 'A', guestId: gid() });
  const b = await new Client(URL).joinById(a.roomId, { name: 'B', guestId: gid() });
  const c = await new Client(URL).joinById(a.roomId, { name: 'C', guestId: gid() });
  const gotB = [], gotC = [];
  b.onMessage('va', (m) => gotB.push(m)); c.onMessage('va', (m) => gotC.push(m));
  for (const r of [a, b, c]) r.onMessage('*', () => {});
  await sleep(150);
  const slot = (r, sid) => r.state.players.get(sid).slot;
  const frame = (mask, len = 323) => { const f = new Uint8Array(6 + len); f[0] = mask & 255; f[1] = (mask >>> 8) & 255; f[4] = 7; f[6] = 42; return f; };
  const toB = 1 << slot(a, b.sessionId), toC = 1 << slot(a, c.sessionId);
  a.sendBytes('va', frame(toB));                                          // A is not on direct voice yet
  await sleep(150);
  assert.equal(gotB.length, 0);
  a.send('voice', { on: true, via: 'p2p' }); b.send('voice', { on: true, via: 'p2p' });   // C stays out of voice
  await sleep(250);
  a.sendBytes('va', frame(toB | toC));
  a.sendBytes('va', frame(0));                                            // no targets
  a.sendBytes('va', frame(toB, 2000));                                    // larger than any audio frame
  await sleep(250);
  assert.equal(gotB.length, 1, 'B gets exactly the one valid frame');
  assert.equal(gotC.length, 0, 'C is not on voice, so gets nothing');
  const m = new Uint8Array(gotB[0]);
  assert.equal(m[0], slot(a, a.sessionId), 'stamped with the sender slot');
  assert.equal(m[1], 7); assert.equal(m[3], 42); assert.equal(m.length, 3 + 323);
  await a.leave(); await b.leave(); await c.leave();
});

test('race: gate order, timing and recovery teleports are validated', async () => {
  const host = await new Client(URL).create('rc', { name: 'H', guestId: gid() });
  let notice = null; host.onMessage('notice', (m) => (notice = m)); host.onMessage('*', () => {});
  host.send('config', { mode: 'race' });
  await sleep(150);
  const gates = [{ x: 0, z: 0, yaw: 0, width: 4 }, { x: 0, z: 30, yaw: 0, width: 4 }, { x: 0, z: 60, yaw: 0, width: 4 }];
  host.send('start', { gates, spawn: { x: 0, z: -10 } });
  await sleep(200);
  assert.equal(host.state.phase, 'countdown', notice?.text);
  let seq = 0;
  const go = (x, z, flags = 0) => host.sendBytes('m', encodeMove(seq++, pose(x, z, { flags })));
  go(0, -3, FLAG.RECOVER); await sleep(450);          // onto the grid: allowed
  await sleep(4000);                                   // countdown
  assert.equal(host.state.phase, 'running');
  const me = () => host.state.players.get(host.sessionId);
  host.send('cp', { i: 1 }); await sleep(150);
  assert.equal(me().cp, -1, 'cannot claim gate 1 first');
  go(0, 0.5); await sleep(80); host.send('cp', { i: 0 }); await sleep(150);
  assert.equal(me().cp, 0, 'gate 0 near the truck counts');
  go(0, 59, FLAG.RECOVER); await sleep(450);           // teleport to the finish: refused
  host.send('cp', { i: 2 }); await sleep(150);
  assert.equal(me().cp, 0, 'a recovery cannot skip the course');
  go(0, 29, FLAG.RECOVER); await sleep(450);           // recovery onto gate 1 (the next gate): allowed...
  host.send('cp', { i: 1 }); await sleep(150);
  assert.equal(me().cp, 0, '...but not faster than the course allows (30 m in under 2.5 s)');
  await sleep(2200);
  go(0, 30.5); await sleep(80); host.send('cp', { i: 1 }); await sleep(150);
  assert.equal(me().cp, 1);
  await host.leave();
});
