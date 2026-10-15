// Voice tokens: minted by the room server only for players in the room, scoped to that room's voice channel,
// microphone-only, short-lived. Uses a throwaway key/secret (no LiveKit server is needed to check a token).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';
import { TokenVerifier } from 'livekit-server-sdk';

const PORT = 2598, URL = `ws://127.0.0.1:${PORT}`;
const KEY = 'APItestkey', SECRET = 'test-secret-that-is-at-least-32-characters-long';
let proc;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
before(async () => {
  proc = spawn(process.execPath, ['src/index.js'], { env: { ...process.env, PORT: String(PORT), LIVEKIT_URL: 'wss://voice.example.test', LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET, LIVEKIT_TOKEN_TTL: '10m' }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return; } catch { /* starting */ } await sleep(100); }
  throw new Error('server did not start');
});
after(() => proc?.kill());

test('a player gets a microphone-only token for their own room, never the secret', async () => {
  const room = await new Client(URL).create('rc', { name: 'Vee', guestId: 'voice-test-' + Date.now() });
  room.onMessage('*', () => {});
  const reply = await new Promise((res) => { room.onMessage('voiceToken', res); room.send('voiceToken'); });
  assert.equal(reply.url, 'wss://voice.example.test');
  assert.ok(!JSON.stringify(reply).includes(SECRET), 'the API secret never leaves the server');
  const claims = await new TokenVerifier(KEY, SECRET).verify(reply.token);
  assert.equal(claims.sub, room.sessionId, 'identity = the player\'s session');
  assert.equal(claims.name, 'Vee');
  assert.equal(claims.video.room, `rc-${room.roomId}`, 'scoped to this room\'s voice channel');
  assert.equal(claims.video.roomJoin, true);
  assert.deepEqual(claims.video.canPublishSources, ['microphone']);
  assert.equal(claims.video.canPublishData, false);
  assert.ok(claims.exp - claims.nbf <= 600 + 5, 'short-lived');
  // rate limited: a second request within the same second is refused
  const again = await new Promise((res) => { room.onMessage('voiceToken', res); room.send('voiceToken'); });
  assert.match(again.error || '', /Too many/);
  await room.leave();
});
