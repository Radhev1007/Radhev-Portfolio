// One multiplayer room: up to 20 players sharing a map, with a lobby, optional game modes and a voice room.
//
// Authority model (stage 1, see README):
//  * Each player's own truck is simulated by that player's browser with the game's existing physics. The
//    server validates every movement update (finite, inside the map, speed and per-update displacement
//    limits, rate) and relays only accepted poses; implausible ones are dropped and the client is corrected.
//  * Everything shared is decided here: room membership, host, ready state, session start/end on the
//    server clock, gate / checkpoint progress (checked against the player's last accepted position and a
//    minimum plausible time), scores, finish order and which breakable posts are down.
//  * Truck-to-truck contact is resolved by each truck's owner against the other trucks' relayed poses, so
//    each truck receives exactly one collision response (its owner's). See README "Authority".
import { Room, ServerError } from '@colyseus/core';
import { Player, RoomState } from './state.js';
import { config, MAPS, MODES, MODE_LIMIT, PALETTE_SIZE } from './config.js';
import { decodeMove, encodeSnapshot, poseSane, FLAG } from '../shared/codec.js';
import { voiceConfigured, voiceToken } from './voice.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I
const activeCodes = new Set();
export const roomStats = { rooms: 0, players: 0 };

function newCode() {
  for (let n = 0; n < 1000; n++) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!activeCodes.has(c)) return c;
  }
  throw new Error('could not allocate a room code');
}

const MAX_SPEED = 25;          // m/s; the truck tops out near 6, falls and tumbles reach more
const SLACK = 1.2;             // m of extra displacement allowed per update (jitter, substep catch-up)
const MOVE_RATE = 40;          // max movement updates / s accepted per player
const COURSE_SPEED = 12;       // m/s: no gate can be reached faster than this along the course
const GATE_SLACK = 4;          // m: a reported gate crossing must be this close to the last accepted pose

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);

export class RcRoom extends Room {
  onCreate(options = {}) {
    this.maxClients = config.maxPlayers;
    this.roomId = newCode();
    activeCodes.add(this.roomId);
    roomStats.rooms++;
    this.setState(new RoomState());
    this.state.code = this.roomId;
    if (MAPS.includes(options.map)) this.state.map = options.map;
    this.setPatchRate(100);

    this.guests = new Map();       // sessionId -> guestId (kept off the shared state)
    this.moves = new Map();        // sessionId -> movement bookkeeping + last accepted pose
    this.pending = new Map();      // sessionId -> reconnection deferred
    this.limits = new Map();       // sessionId -> { key: { t, n } } message rate windows
    this.courseData = null;
    this.finishCount = 0;

    this.onMessage('m', (client, bytes) => this.onMove(client, bytes));
    this.onMessage('ping', (client, m) => {
      const p = this.player(client);
      if (p && m && isNum(m.rtt)) p.ping = Math.max(0, Math.min(9999, Math.round(m.rtt)));
      client.send('pong', { c: m && isNum(m.c) ? m.c : 0, s: Date.now() });
    });
    this.onMessage('profile', (client, m) => this.onProfile(client, m));
    this.onMessage('ready', (client, m) => { const p = this.player(client); if (p && this.state.phase !== 'running') p.ready = !!(m && m.ready); });
    this.onMessage('config', (client, m) => this.onConfig(client, m));
    this.onMessage('start', (client, m) => this.onStart(client, m));
    this.onMessage('lobby', (client) => { if (this.isHost(client)) this.toLobby(); });
    this.onMessage('cp', (client, m) => this.onGate(client, m));
    this.onMessage('runFail', (client) => { const p = this.player(client); if (p && this.state.mode === 'timed') { p.cp = -1; this.moves.get(client.sessionId).runStart = 0; } });
    this.onMessage('score', (client, m) => this.onScore(client, m));
    this.onMessage('ev', (client, m) => this.onEvent(client, m));
    this.onMessage('brk', (client, m) => this.onBreak(client, m));
    this.onMessage('voice', (client, m) => { const p = this.player(client); if (p && m) { p.voice = !!m.on; p.mic = !!m.mic && !!m.on; } });
    this.onMessage('voiceToken', (client) => this.onVoiceToken(client));
    this.onMessage('*', (client, type) => console.warn(`[${this.roomId}] unknown message ${String(type).slice(0, 20)} from ${client.sessionId}`));

    this.setSimulationInterval(() => this.tick(), 50);   // 20 Hz snapshots + session clock
  }

  // ------------------------------------------------------------ membership
  onAuth(client, options = {}, context) {
    if (config.allowedOrigins.length) {
      const origin = context?.headers?.origin;
      if (!origin || !config.allowedOrigins.includes(origin)) throw new ServerError(403, 'This page is not allowed to join');
    }
    const guestId = typeof options.guestId === 'string' && /^[\w-]{8,64}$/.test(options.guestId) ? options.guestId : null;
    if (!guestId) throw new ServerError(400, 'Missing player id');
    for (const [sid, gid] of this.guests) {
      if (gid !== guestId) continue;
      const p = this.state.players.get(sid);
      if (p && p.connected) throw new ServerError(409, 'You are already in this room (in another tab?)');
    }
    return { guestId };
  }

  onJoin(client, options = {}, auth) {
    // a fresh join from a player whose previous seat is still waiting for a reconnection: drop the stale seat
    for (const [sid, gid] of this.guests) if (gid === auth.guestId && sid !== client.sessionId) this.dropSeat(sid);

    const used = new Set([...this.state.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const p = new Player();
    p.slot = slot;
    p.joinedAt = Date.now();
    p.name = this.uniqueName(cleanName(options.name) || `Driver ${slot + 1}`, client.sessionId);
    const takenColors = new Set([...this.state.players.values()].map((q) => q.color));
    const want = Number.isInteger(options.color) && options.color >= 0 && options.color < PALETTE_SIZE ? options.color : slot;
    p.color = !takenColors.has(want) ? want : [...Array(PALETTE_SIZE).keys()].find((c) => !takenColors.has(c)) ?? 0;
    // joining mid-session: drive along in free roam, or watch (driving, unscored) until the next start
    const live = this.state.phase === 'countdown' || this.state.phase === 'running';
    p.status = !live ? 'lobby' : this.state.mode === 'free' ? 'driving' : 'spectating';
    if (![...this.state.players.values()].some((q) => q.host)) { p.host = true; p.ready = true; }
    this.state.players.set(client.sessionId, p);
    this.guests.set(client.sessionId, auth.guestId);
    this.moves.set(client.sessionId, { seq: -1, t: 0, has: false, rejects: 0, rejectT: 0, recoverT: 0, runStart: 0, tokens: 1500, tokT: Date.now() });
    roomStats.players++;
    console.log(`[${this.roomId}] join ${p.name} (${client.sessionId}) slot ${slot} — ${this.clients.length}/${this.maxClients}`);
  }

  async onLeave(client, consented) {
    const p = this.player(client);
    if (!p) return;
    p.connected = false;
    p.voice = false; p.mic = false;
    if (p.host) this.passHost(client.sessionId);
    if (!consented) {
      try {
        const deferred = this.allowReconnection(client, config.reconnectSeconds);
        this.pending.set(client.sessionId, deferred);
        await deferred;
        this.pending.delete(client.sessionId);
        if (!this.state.players.has(client.sessionId)) return;
        p.connected = true;
        const mv = this.moves.get(client.sessionId); if (mv) { mv.has = false; mv.seq = -1; }
        console.log(`[${this.roomId}] reconnected ${p.name}`);
        return;
      } catch { this.pending.delete(client.sessionId); }
    }
    this.removePlayer(client.sessionId);
  }

  onDispose() {
    activeCodes.delete(this.roomId);
    roomStats.rooms = Math.max(0, roomStats.rooms - 1);
    console.log(`[${this.roomId}] disposed`);
  }

  dropSeat(sid) {
    const d = this.pending.get(sid);
    if (d) { this.pending.delete(sid); try { d.reject(new Error('replaced')); } catch { /* already settled */ } }
    else this.removePlayer(sid);
  }

  removePlayer(sid) {
    const p = this.state.players.get(sid);
    if (!p) return;
    const wasHost = p.host;
    this.state.players.delete(sid);
    this.guests.delete(sid); this.moves.delete(sid); this.limits.delete(sid);
    roomStats.players = Math.max(0, roomStats.players - 1);
    if (wasHost) this.passHost(sid);
    console.log(`[${this.roomId}] left ${p.name} — ${this.state.players.size} players`);
  }

  passHost(fromSid) {
    const from = this.state.players.get(fromSid);
    const next = [...this.state.players.entries()].filter(([sid, q]) => sid !== fromSid && q.connected).sort((a, b) => a[1].joinedAt - b[1].joinedAt)[0];
    if (!next) return;                       // nobody else here: keep the host until they come back or leave
    if (from) from.host = false;
    next[1].host = true; next[1].ready = true;
  }

  player(client) { return this.state.players.get(client.sessionId); }
  isHost(client) { return !!this.player(client)?.host; }

  uniqueName(name, sid) {
    const taken = new Set([...this.state.players.entries()].filter(([s]) => s !== sid).map(([, q]) => q.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) { const n = `${name.slice(0, 13)} ${i}`; if (!taken.has(n.toLowerCase())) return n; }
    return name;
  }

  // simple per-player, per-kind rate limiting (a sliding one-second window)
  allow(client, key, perSecond) {
    let m = this.limits.get(client.sessionId); if (!m) this.limits.set(client.sessionId, (m = {}));
    const now = Date.now(), w = m[key] || (m[key] = { t: now, n: 0 });
    if (now - w.t > 1000) { w.t = now; w.n = 0; }
    return ++w.n <= perSecond;
  }

  // ------------------------------------------------------------ movement
  onMove(client, bytes) {
    const mv = this.moves.get(client.sessionId), p = this.player(client);
    if (!mv || !p || !p.connected || !(bytes instanceof Uint8Array)) return;
    if (!this.allow(client, 'm', MOVE_RATE)) return;
    const s = decodeMove(bytes);
    if (!s || !poseSane(s)) return this.reject(client, mv);
    // sequence numbers wrap at 65536; ignore stale / duplicated packets
    if (mv.seq >= 0) { const d = (s.seq - mv.seq + 65536) % 65536; if (d === 0 || d > 30000) return; }
    const now = Date.now();
    if (mv.has) {
      const dt = Math.min(1, (now - mv.t) / 1000);
      const dist = Math.hypot(s.x - mv.x, s.y - mv.y, s.z - mv.z);
      const recover = (s.flags & FLAG.RECOVER) && now - mv.recoverT > 400;
      if (recover) {
        if (!this.recoverAllowed(client, s)) return this.reject(client, mv);
        mv.recoverT = now;
      } else if (dist > MAX_SPEED * dt + SLACK) return this.reject(client, mv);
    }
    mv.seq = s.seq; mv.t = now; mv.has = true;
    for (const k of ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'vx', 'vy', 'vz', 'steer', 'throttle', 'flags']) mv[k] = s[k];
    mv.hub = s.hub.slice();
    mv.rejects = 0;
  }

  // In a scored session a recovery may only put the truck back somewhere the game itself would: the spawn
  // area / starting grid, or (race, co-op, timed) a gate the player has legitimately reached. Free roam and
  // stunts allow any recovery: there is nothing to gain from a teleport there.
  recoverAllowed(client, s) {
    const st = this.state, c = this.courseData, p = this.player(client);
    if (!c || !p || st.mode === 'free' || st.mode === 'stunt' || (st.phase !== 'countdown' && st.phase !== 'running')) return true;
    const near = (q, r) => q && Math.hypot(s.x - q.x, s.z - q.z) <= r;
    if (c.spawn && near(c.spawn, 36)) return true;
    if (c.gates) {
      if (near(c.gates[0], 36)) return true;                                    // starting grid behind gate 0
      const upTo = st.mode === 'race' ? p.cp + 1 : st.mode === 'coop' ? st.team : 0;
      for (let i = 0; i <= Math.min(upTo, c.gates.length - 1); i++) if (near(c.gates[i], 8)) return true;
    }
    return false;
  }

  reject(client, mv) {
    const now = Date.now();
    if (now - mv.rejectT > 1000) { mv.rejectT = now; mv.rejects = 0; }
    // a few dropped packets are fine; a sustained stream means the client is out of step: put it back
    if (++mv.rejects >= 3 && mv.has) {
      mv.rejects = 0;
      const yaw = Math.atan2(2 * (mv.qw * mv.qy + mv.qx * mv.qz), 1 - 2 * (mv.qy * mv.qy + mv.qx * mv.qx));
      client.send('correct', { x: mv.x, z: mv.z, yaw });
    }
  }

  tick() {
    const now = Date.now(), entries = [];
    for (const [sid, mv] of this.moves) {
      const p = this.state.players.get(sid);
      if (!p || !p.connected || !mv.has || now - mv.t > 3000) continue;
      entries.push({ slot: p.slot, ...mv });
    }
    if (entries.length) this.broadcastBytes('s', encodeSnapshot(now, entries), {});
    this.sessionClock(now);
  }

  // ------------------------------------------------------------ lobby
  onProfile(client, m) {
    const p = this.player(client);
    if (!p || !m || !this.allow(client, 'profile', 4)) return;
    const name = cleanName(m.name);
    if (name) p.name = this.uniqueName(name, client.sessionId);
    if (Number.isInteger(m.color) && m.color >= 0 && m.color < PALETTE_SIZE) {
      const taken = [...this.state.players.entries()].some(([sid, q]) => sid !== client.sessionId && q.color === m.color);
      if (!taken) p.color = m.color;
      else client.send('notice', { text: 'That colour is taken' });
    }
  }

  onConfig(client, m) {
    if (!this.isHost(client) || !m || this.state.phase === 'countdown' || this.state.phase === 'running') return;
    if (MAPS.includes(m.map) && m.map !== this.state.map) { this.state.map = m.map; this.state.broken.clear(); this.state.challenge = ''; }
    if (MODES.includes(m.mode)) this.state.mode = m.mode;
    if (typeof m.challenge === 'string' && m.challenge.length <= 40) this.state.challenge = m.challenge;
  }

  onStart(client, m) {
    if (!this.isHost(client)) return;
    if (this.state.phase === 'countdown' || this.state.phase === 'running') return;
    const others = [...this.state.players.values()].filter((p) => p.connected && !p.host);
    if (others.some((p) => !p.ready)) return client.send('notice', { text: 'Waiting for everyone to be ready' });
    const mode = this.state.mode;
    let course = null;
    if (mode === 'race' || mode === 'timed' || mode === 'coop') {
      const g = m && Array.isArray(m.gates) ? m.gates : null;
      if (!g || g.length < 2 || g.length > 40 || !g.every((q) => q && isNum(q.x) && isNum(q.z) && isNum(q.yaw) && isNum(q.width) && Math.abs(q.x) < 72 && Math.abs(q.z) < 72 && q.width > 0 && q.width < 12)) {
        return client.send('notice', { text: 'Pick a course for this mode' });
      }
      course = { gates: g.map((q) => ({ x: +q.x.toFixed(2), z: +q.z.toFixed(2), yaw: +q.yaw.toFixed(4), width: +q.width.toFixed(2) })) };
      // minimum plausible time to reach each gate along the course
      let acc = 0; course.minT = [0];
      for (let i = 1; i < course.gates.length; i++) { const a = course.gates[i - 1], b = course.gates[i]; acc += Math.hypot(b.x - a.x, b.z - a.z); course.minT.push(acc / COURSE_SPEED * 1000); }
    } else if (mode === 'checkpoint') {
      const pts = m && Array.isArray(m.points) ? m.points.filter((q) => q && isNum(q.x) && isNum(q.z) && Math.abs(q.x) < 72 && Math.abs(q.z) < 72) : [];
      if (pts.length < 3) return client.send('notice', { text: 'This map has no checkpoint spots' });
      // the server picks the checkpoints, so no client chooses an easy set
      const pick = [...pts].sort(() => Math.random() - 0.5).slice(0, Math.min(8, pts.length));
      course = { points: pick.map((q) => ({ x: +q.x.toFixed(2), z: +q.z.toFixed(2) })) };
    }
    // where the game puts trucks at the start and on a plain recovery (validated like any course point)
    const sp = m && m.spawn;
    if (course && sp && isNum(sp.x) && isNum(sp.z) && Math.abs(sp.x) < 72 && Math.abs(sp.z) < 72) course.spawn = { x: sp.x, z: sp.z };
    this.courseData = course;
    const now = Date.now();
    const s = this.state;
    s.course = course ? JSON.stringify({ gates: course.gates, points: course.points }) : '';
    s.session++;
    s.team = 0; s.teamTime = 0;
    s.broken.clear();
    s.startAt = now + 4000;
    s.endAt = MODE_LIMIT[mode] ? s.startAt + MODE_LIMIT[mode] : 0;
    s.phase = 'countdown';
    this.finishCount = 0;
    for (const [sid, p] of s.players) {
      p.cp = -1; p.mask = 0; p.score = 0; p.finish = 0; p.best = 0; p.runs = 0;
      p.status = p.connected ? 'driving' : 'spectating';
      const mv = this.moves.get(sid); if (mv) { mv.runStart = 0; mv.tokens = 1500; mv.recoverT = 0; }
    }
    console.log(`[${this.roomId}] start ${mode} on ${s.map} (${s.players.size} players)`);
  }

  toLobby() {
    const s = this.state;
    s.phase = 'lobby'; s.startAt = 0; s.endAt = 0; s.course = ''; this.courseData = null;
    for (const p of s.players.values()) { p.status = 'lobby'; if (!p.host) p.ready = false; }
  }

  sessionClock(now) {
    const s = this.state;
    if (s.phase === 'countdown' && now >= s.startAt) s.phase = 'running';
    if (s.phase !== 'running') return;
    if (s.endAt && now >= s.endAt) return this.endSession();
    const racers = [...s.players.values()].filter((p) => p.connected && p.status !== 'spectating');
    if (!racers.length) return;
    if ((s.mode === 'race' || s.mode === 'checkpoint') && racers.every((p) => p.status === 'finished')) this.endSession();
    if (s.mode === 'coop' && s.teamTime) this.endSession();
  }

  endSession() {
    this.state.phase = 'results';
    for (const p of this.state.players.values()) if (!p.host) p.ready = false;
  }

  // ------------------------------------------------------------ gates, checkpoints, scores
  onGate(client, m) {
    const s = this.state, p = this.player(client), mv = this.moves.get(client.sessionId), c = this.courseData;
    if (!p || !mv || !c || s.phase !== 'running' || p.status !== 'driving' || !m || !Number.isInteger(m.i)) return;
    if (!this.allow(client, 'cp', 10)) return;
    const now = Date.now(), el = now - s.startAt;
    const near = (x, z, r) => mv.has && now - mv.t < 1500 && Math.hypot(mv.x - x, mv.z - z) <= r;

    if (s.mode === 'checkpoint') {
      const q = c.points[m.i];
      if (!q || p.mask & (1 << m.i) || !near(q.x, q.z, 3.5 + GATE_SLACK)) return;
      p.mask |= 1 << m.i; p.score++;
      if (p.score >= c.points.length) { p.finish = el; p.status = 'finished'; }
      return;
    }
    const g = c.gates[m.i];
    if (!g || !near(g.x, g.z, g.width / 2 + GATE_SLACK)) return;
    if (s.mode === 'race') {
      if (m.i !== p.cp + 1 || el < c.minT[m.i]) return;
      p.cp = m.i;
      if (m.i === c.gates.length - 1) { p.finish = el; p.status = 'finished'; this.finishCount++; }
    } else if (s.mode === 'timed') {
      if (m.i === 0) { mv.runStart = now; p.cp = 0; return; }
      if (!mv.runStart || m.i !== p.cp + 1 || now - mv.runStart < c.minT[m.i] - c.minT[0]) return;
      p.cp = m.i;
      if (m.i === c.gates.length - 1) {
        const t = now - mv.runStart;           // timed on the server clock, not the client's
        p.runs++; if (!p.best || t < p.best) p.best = t;
        p.cp = -1; mv.runStart = 0;
      }
    } else if (s.mode === 'coop') {
      if (m.i !== s.team || el < c.minT[m.i]) return;
      s.team++; p.score++;
      if (s.team >= c.gates.length) s.teamTime = el;
    }
  }

  onScore(client, m) {
    const s = this.state, p = this.player(client), mv = this.moves.get(client.sessionId);
    if (!p || !mv || s.mode !== 'stunt' || s.phase !== 'running' || !m || !isNum(m.pts) || m.pts <= 0) return;
    // a refilling budget caps how fast points can arrive (300 / s, bursts up to 1500): a big jump or a long
    // drift scores fully, a client inventing points cannot run away with it
    const now = Date.now();
    mv.tokens = Math.min(1500, mv.tokens + (now - mv.tokT) * 0.3); mv.tokT = now;
    const pts = Math.min(Math.round(m.pts), 600, Math.floor(mv.tokens));
    if (pts <= 0) return;
    mv.tokens -= pts; p.score += pts;
  }

  // collisions, landings, rollovers and recoveries other players should hear or see (relayed, not applied)
  onEvent(client, m) {
    const p = this.player(client);
    if (!p || !m || !['hit', 'land', 'roll', 'recover', 'horn'].includes(m.k) || !this.allow(client, 'ev', 15)) return;
    if (![m.x, m.y, m.z].every(isNum) || (m.s !== undefined && !isNum(m.s))) return;
    this.broadcast('ev', { k: m.k, slot: p.slot, x: m.x, y: m.y, z: m.z, s: Math.max(0, Math.min(30, m.s || 0)), mat: typeof m.mat === 'string' ? m.mat.slice(0, 12) : undefined }, { except: client });
  }

  // a breakable post went down: first report wins, everyone (and later joiners, via state) sees it down
  onBreak(client, m) {
    const p = this.player(client);
    if (!p || !m || !Number.isInteger(m.i) || m.i < 0 || m.i > 4095 || !this.allow(client, 'brk', 10)) return;
    if (this.state.broken.includes(m.i)) return;
    this.state.broken.push(m.i);
    const fx = isNum(m.fx) ? m.fx : 0, fz = isNum(m.fz) ? m.fz : 0;
    this.broadcast('brk', { i: m.i, fx, fz, s: isNum(m.s) ? Math.min(10, m.s) : 1 }, { except: client });
  }

  // ------------------------------------------------------------ voice
  async onVoiceToken(client) {
    if (!this.allow(client, 'voiceToken', 1)) return client.send('voiceToken', { error: 'Too many requests, try again' });
    if (!voiceConfigured()) return client.send('voiceToken', { error: 'Voice chat is not configured on this server' });
    const p = this.player(client);
    if (!p) return;
    try {
      client.send('voiceToken', await voiceToken({ room: `rc-${this.roomId}`, identity: client.sessionId, name: p.name }));
    } catch (e) {
      console.error(`[${this.roomId}] voice token failed`, e);
      client.send('voiceToken', { error: 'Could not create a voice token' });
    }
  }
}
