// Load-test helper: fills a room with simulated drivers that send real movement packets at the game's rate
// (20 Hz) and read every snapshot, like browser clients do.
//   node scripts/bots.mjs <ROOMCODE> [count=18] [url=ws://localhost:2567] [cx cz]
// Bots circle around (cx, cz) (default: the map spawn area you pass in) and report what they receive.
import { Client } from 'colyseus.js';
import { encodeMove, decodeSnapshot } from '../shared/codec.js';

const [code, n = '18', url = 'ws://localhost:2567', cx = '0', cz = '0'] = process.argv.slice(2);
if (!code) { console.error('usage: node scripts/bots.mjs ROOMCODE [count] [url] [cx cz]'); process.exit(1); }

const bots = [];
let snaps = 0, bytes = 0, rejected = 0;
for (let i = 0; i < +n; i++) {
  try {
    const room = await new Client(url).joinById(code, { name: `Bot ${i + 1}`, guestId: `bot-${i}-${Date.now().toString(36)}`, color: (i + 3) % 20 });
    room.onMessage('s', (b) => { snaps++; bytes += b.byteLength; decodeSnapshot(b, () => {}); });
    room.onMessage('correct', () => rejected++);
    room.onMessage('*', () => {});
    room.send('ready', { ready: true });
    bots.push({ room, a: (i / +n) * Math.PI * 2, r: 6 + (i % 4) * 2.5, seq: 0 });
  } catch (e) { console.log(`bot ${i + 1}: ${e.message}`); }
}
console.log(`${bots.length} bots in ${code}`);

const t0 = Date.now();
const timer = setInterval(() => {
  const t = (Date.now() - t0) / 1000;
  for (const b of bots) {
    const w = 0.35, a = b.a + t * w;
    const x = +cx + Math.cos(a) * b.r, z = +cz + Math.sin(a) * b.r;
    const yaw = a + Math.PI;     // tangent of the circle
    const s = { x, y: 1.0, z, qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), vx: -Math.sin(a) * b.r * w, vy: 0, vz: Math.cos(a) * b.r * w, steer: 0.2, throttle: 0.6, hub: [-0.1, -0.1, -0.1, -0.1], flags: 1 };
    b.room.sendBytes('m', encodeMove(b.seq++, s));
  }
}, 50);
const report = setInterval(() => { console.log(`snapshots/s per bot ${(snaps / bots.length / 5).toFixed(1)}, avg ${(bytes / Math.max(1, snaps)).toFixed(0)} B, corrections ${rejected}`); snaps = 0; bytes = 0; }, 5000);
process.on('SIGINT', async () => { clearInterval(timer); clearInterval(report); for (const b of bots) await b.room.leave(); process.exit(0); });
