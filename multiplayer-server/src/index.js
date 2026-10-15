// RC Crawler multiplayer server: Colyseus rooms over WebSockets, plus a tiny HTTP surface (health check).
// Deploy separately from the static game; see README.md.
import http from 'node:http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RcRoom, roomStats } from './RcRoom.js';
import { config } from './config.js';
import { voiceConfigured } from './voice.js';

const app = express();
app.disable('x-powered-by');
app.get('/health', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ ok: true, rooms: roomStats.rooms, players: roomStats.players, voice: voiceConfigured(), maxPlayers: config.maxPlayers });
});
app.get('/', (req, res) => res.type('text').send('RC Crawler multiplayer server is running.'));

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server, pingInterval: 4000, pingMaxRetries: 3, maxPayload: 32 * 1024 }),
});
gameServer.define('rc', RcRoom);

await gameServer.listen(config.port, config.host);
console.log(`RC Crawler multiplayer listening on ${config.host}:${config.port} — max ${config.maxPlayers} per room, voice ${voiceConfigured() ? 'on' : 'off (LIVEKIT_* not set)'}`);

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { console.log(`${sig}: shutting down`); gameServer.gracefullyShutdown().then(() => process.exit(0)); });
