// Online multiplayer: connection, clock sync, movement send loop, remote trucks, shared posts.
// Nothing here loads or runs until the player opens Multiplayer, so single player is untouched.
//
// Network budget per player: 20 movement updates/s up (35 B each) and 20 snapshots/s down (34 B per truck);
// lobby / session / score state as Colyseus delta patches at 10 Hz; gameplay events as small messages.
// The render and physics loops never wait on the network: tick() reads whatever has arrived.
import { multiplayerUrl } from './config.js';
import { RemoteFleet } from './remote.js';
import { encodeMove, decodeSnapshot, FLAG, MOVE_BYTES } from '../../vendor/net/codec.js';

const SEND_HZ = 20;
const PING_EVERY = 2000;
const GUEST_KEY = 'rccrawler.mp.guest';      // sessionStorage: one identity per tab
const PROFILE_KEY = 'rccrawler.mp.profile';  // localStorage: remembered name + livery
const SEAT_KEY = 'rccrawler.mp.seat';        // sessionStorage: reconnection token across a page reload

let colyseusLoad = null;
function loadColyseus() {
  if (window.Colyseus) return Promise.resolve(window.Colyseus);
  return (colyseusLoad ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('../../vendor/net/colyseus.js', import.meta.url).href;
    s.onload = () => res(window.Colyseus);
    s.onerror = () => { colyseusLoad = null; rej(new Error('Could not load the multiplayer client')); };
    document.head.appendChild(s);
  }));
}

const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
function store(kind, key, val) { try { (kind === 's' ? sessionStorage : localStorage)[val === undefined ? 'removeItem' : 'setItem'](key, val); } catch { /* private mode */ } }
function load(kind, key) { try { return (kind === 's' ? sessionStorage : localStorage).getItem(key); } catch { return null; } }

// map server/library errors to something a player can act on
function friendly(e) {
  const m = String(e?.message || e || '');
  const code = e?.code;
  if (/already in this room/i.test(m)) return m;
  if (/not allowed/i.test(m)) return 'This page is not allowed to join that server';
  if (/locked|full|maxClients/i.test(m)) return 'That room is full (20 players max)';
  if (code === 4212 || /not found|no rooms found|invalid room/i.test(m)) return 'No room with that code. Check it and try again';
  if (/ECONNREFUSED|Failed to fetch|NetworkError|network|offline|connect/i.test(m) || code === 0) return 'Cannot reach the multiplayer server';
  return m || 'Something went wrong';
}

export class Multiplayer {
  constructor(game) {
    this.game = game;                  // hooks into the existing game (see main.js)
    this.url = multiplayerUrl();
    this.room = null;
    this.status = 'offline';           // offline | connecting | online | reconnecting
    this.error = '';
    this.fleet = new RemoteFleet(game.scene());
    this.listeners = {};
    this.seq = 0; this.sendAcc = 0;
    this.moveBuf = new Uint8Array(MOVE_BYTES);
    this.pose = { hub: [0, 0, 0, 0] };
    this.rtt = 0; this.offset = 0; this.offsetOk = false; this.lastPong = 0; this.pingT = 0;
    this.recoverFlag = 0;
    this.broken = new Set();           // post indices down this session (mirrors room state)
    this.guestId = load('s', GUEST_KEY) || randomId();
    store('s', GUEST_KEY, this.guestId);
    try { this.profile = JSON.parse(load('l', PROFILE_KEY) || 'null'); } catch { this.profile = null; }
    if (!this.profile) this.profile = { name: '', color: Math.floor(Math.random() * 20) };
    this._scratch = {};
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  get available() { return !!this.url; }
  get active() { return !!this.room; }
  // the room's state arrives just after the join resolves: until then there is no player list yet
  get state() { return this.room?.state?.players ? this.room.state : null; }
  get me() { return this.state ? this.state.players.get(this.room.sessionId) : null; }
  get isHost() { return !!this.me?.host; }
  get code() { return this.room?.roomId || ''; }
  get players() { return this.state ? [...this.state.players.entries()].map(([sid, p]) => ({ sid, p })) : []; }
  serverNow() { return performance.now() + this.offset; }

  saveProfile(p) { Object.assign(this.profile, p); store('l', PROFILE_KEY, JSON.stringify(this.profile)); if (this.room) this.room.send('profile', this.profile); }

  // ------------------------------------------------------------ connect / leave
  async create() { return this.connect((c, opts) => c.create('rc', { ...opts, map: this.game.levelId() })); }
  async join(code) {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { this.setError('Room codes are 5 letters/numbers'); return false; }
    return this.connect((c, opts) => c.joinById(code, opts));
  }
  // a seat kept across a page reload (same tab) within the reconnection window
  async resume() {
    let seat; try { seat = JSON.parse(load('s', SEAT_KEY) || 'null'); } catch { seat = null; }
    if (!seat || !this.url || Date.now() - seat.t > 25000) return false;
    return this.connect((c) => c.reconnect(seat.token), true);
  }

  async connect(fn, quiet = false) {
    if (!this.url) { this.setError('Multiplayer server is not configured'); return false; }
    if (this.room || this.status === 'connecting') return false;
    this.setStatus('connecting'); this.error = '';
    try {
      const C = await loadColyseus();
      this.client = this.client || new C.Client(this.url);
      const room = await fn(this.client, { name: this.profile.name, color: this.profile.color, guestId: this.guestId });
      this.attach(room);
      return true;
    } catch (e) {
      console.warn('[mp] connect failed', e);
      if (this.room) { try { this.room.leave(true); } catch { /* not open */ } this.room = null; }
      this.setStatus('offline');
      if (!quiet) this.setError(friendly(e));
      store('s', SEAT_KEY);
      return false;
    }
  }

  attach(room) {
    this.room = room;
    this.setStatus('online');
    this.offsetOk = false; this.pingT = 0;
    store('s', SEAT_KEY, JSON.stringify({ token: room.reconnectionToken, t: Date.now() }));
    room.onMessage('s', (bytes) => this.onSnapshot(bytes));
    room.onMessage('pong', (m) => this.onPong(m));
    room.onMessage('ev', (m) => this.game.remoteEvent?.(m));
    room.onMessage('brk', (m) => this.applyBreak(m.i, m.fx, m.fz, m.s));
    room.onMessage('correct', (m) => { this.game.placeAt(m.x, m.z, m.yaw); this.flagRecover(); this.emit('notice', 'Position corrected by the server'); });
    room.onMessage('notice', (m) => this.emit('notice', m.text));
    room.onMessage('voiceToken', (m) => this.emit('voiceToken', m));
    room.onStateChange(() => this.onState());
    room.onError((code, msg) => { console.warn('[mp] room error', code, msg); this.setError(friendly({ code, message: msg })); });
    room.onLeave((code) => this.onLeave(code));
    this.onState();
    this.emit('joined');
  }

  async leave() {
    const r = this.room;
    this.detach();
    store('s', SEAT_KEY);
    if (r) { try { await r.leave(true); } catch { /* already gone */ } }
    this.emit('left');
  }

  detach() {
    this.room = null;
    this.fleet.clear();
    this.game.setRemoteColliders([]);
    this.broken.clear();
    this.game.unbreakAll?.();
    this.setStatus('offline');      // last: listeners run against the cleaned-up world
  }

  // unexpected drop: keep the world, try to get the same seat back (server holds it for 30 s)
  async onLeave(code) {
    if (!this.room) return;
    const token = this.room.reconnectionToken;
    if (code === 1000 || code === 4000) { this.detach(); store('s', SEAT_KEY); this.emit('left'); return; }
    this.room = null;
    this.setStatus('reconnecting');
    this.emit('change');
    for (let i = 0, wait = 800; i < 8 && this.status === 'reconnecting'; i++, wait = Math.min(wait * 1.7, 5000)) {
      await new Promise((r) => setTimeout(r, wait));
      try {
        const room = await this.client.reconnect(token);
        this.attach(room);
        this.emit('notice', 'Reconnected');
        return;
      } catch { /* server still unreachable: keep trying */ }
    }
    if (this.status === 'reconnecting') {
      this.detach(); store('s', SEAT_KEY);
      this.setError('Lost connection to the room');
      this.emit('left');
    }
  }

  setStatus(s) { this.status = s; this.emit('change'); }
  setError(e) { this.error = e; this.emit('error', e); this.emit('change'); }

  // ------------------------------------------------------------ state
  onState() {
    const st = this.state;
    if (!st) return;
    // remote trucks: create / restyle / remove to match the player list
    const live = new Set();
    for (const [sid, p] of st.players) {
      if (sid === this.room.sessionId) continue;
      live.add(p.slot);
      const t = this.fleet.get(p.slot);
      const v = this.game.voiceInfo?.(sid) || {};
      t.setLook(p.color, p.name, !!v.speaking, !!p.mic);
      t.sid = sid;
    }
    for (const slot of [...this.fleet.trucks.keys()]) if (!live.has(slot)) this.fleet.remove(slot);
    this.game.setRemoteColliders(this.fleet.colliders);
    // shared posts: anything the room says is down, is down here too
    for (const i of st.broken) if (!this.broken.has(i)) this.applyBreak(i, 0, 0, 1);
    if (this.broken.size && st.broken.length === 0) { this.broken.clear(); this.game.unbreakAll?.(); }
    if (st.map && st.map !== this.game.levelId()) this.game.loadMap(st.map);
    this.emit('change');
  }

  // ------------------------------------------------------------ movement
  // snapshots are stamped with the server's send time; with the synced clock offset that places every
  // truck on one shared timeline, free of how long each packet took to arrive
  onSnapshot(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 9) return;
    const mine = this.me?.slot;
    const t = new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
    if (!this.offsetOk) { this.offset = t - performance.now(); this.offsetOk = true; }   // until the first pong
    decodeSnapshot(bytes, (slot, s, poseT) => { if (slot !== mine) this.fleet.trucks.get(slot)?.push(poseT, s); }, this._scratch);
  }

  onPong(m) {
    const now = performance.now();
    const rtt = now - m.c;
    if (rtt < 0 || rtt > 10000) return;
    this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
    const off = m.s + rtt / 2 - now;
    // prefer low-latency samples for the clock offset; never jump backwards by more than a little
    if (!this.offsetOk) { this.offset = off; this.offsetOk = true; }
    else this.offset += (off - this.offset) * (rtt <= this.rtt * 1.2 ? 0.25 : 0.05);
    this.lastPong = now;
    this.emit('ping', this.rtt);
  }

  flagRecover() { this.recoverFlag = 3; }   // the next few packets may move the truck by any amount

  // before the local physics step: place the remote trucks for this frame
  preStep(dt) {
    if (!this.room && this.status !== 'reconnecting') return;
    const now = this.serverNow();
    this.fleet.update(dt, now - RemoteFleet.INTERP_DELAY, now, (RemoteFleet.INTERP_DELAY + this.rtt / 2 + 25) / 1000, this.game.eye?.());
  }

  // after the local physics step: send our truck, watch for shared events
  postStep(dt, phys, inp, extra) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.pingT > PING_EVERY) { this.pingT = now; this.room.send('ping', { c: now, rtt: Math.round(this.rtt) }); }
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / SEND_HZ) {
      this.sendAcc %= 1 / SEND_HZ;
      const s = this.pose;
      s.x = phys.pos.x; s.y = phys.pos.y; s.z = phys.pos.z;
      s.qx = phys.q.x; s.qy = phys.q.y; s.qz = phys.q.z; s.qw = phys.q.w;
      s.vx = phys.vel.x; s.vy = phys.vel.y; s.vz = phys.vel.z;
      s.steer = phys.steer; s.throttle = phys.throttle;
      for (let i = 0; i < 4; i++) s.hub[i] = phys.hubLocalY(i);
      s.flags = (extra.lights ? FLAG.LIGHTS : 0) | (extra.brake ? FLAG.BRAKE : 0) | (phys.upsideTimer > 1.2 ? FLAG.ROLLED : 0)
        | (phys.airT > 0.08 ? FLAG.AIR : 0) | (this.recoverFlag > 0 ? FLAG.RECOVER : 0) | (phys.gear.name === 'HIGH' ? FLAG.HIGH : 0) | (phys.dig ? FLAG.DIG : 0);
      if (this.recoverFlag > 0) this.recoverFlag--;
      this.room.sendBytes('m', encodeMove(this.seq++ & 0xffff, s, this.moveBuf));
    }
    // posts our truck broke this frame become shared; notable impacts are relayed for others to hear
    for (const e of phys.events) {
      if (e.type === 'break' && e.post && e.post.netId !== undefined && !this.broken.has(e.post.netId)) {
        this.broken.add(e.post.netId);
        this.room.send('brk', { i: e.post.netId, fx: e.post.fallDir?.x || 0, fz: e.post.fallDir?.z || 0, s: e.speed || 1 });
      } else if (e.type === 'hit' && e.speed > 1.2 && e.post?.kind !== 'truck') {
        this.relay('hit', e.p, e.speed, e.mat);
      } else if (e.type === 'land' && e.air > 0.3) {
        this.relay('land', e.p, e.speed);
      }
    }
  }

  relay(k, p, s, mat) {
    const now = performance.now();
    if (now - (this._relayT || 0) < 120) return;    // a burst of contacts is one sound
    this._relayT = now;
    this.room?.send('ev', { k, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), s: +(s || 0).toFixed(2), mat });
  }

  applyBreak(i, fx, fz, speed) {
    if (this.broken.has(i)) return;
    this.broken.add(i);
    this.game.breakPost?.(i, fx, fz, speed);
  }

  connectionQuality() {
    if (this.status === 'reconnecting') return { level: 0, label: 'Reconnecting…' };
    if (!this.room) return { level: 0, label: 'Offline' };
    if (performance.now() - this.lastPong > 6000 && this.lastPong) return { level: 1, label: 'Unstable' };
    const r = this.rtt;
    return r < 90 ? { level: 3, label: `${Math.round(r)} ms` } : r < 200 ? { level: 2, label: `${Math.round(r)} ms` } : { level: 1, label: `${Math.round(r)} ms` };
  }

  inviteLink() {
    const code = this.code;
    try {
      if (window.top !== window.self && window.top.location.origin === location.origin) {
        const u = new URL(window.top.location.href); u.search = ''; u.hash = ''; u.searchParams.set('rc', code);
        return u.toString();
      }
    } catch { /* cross-origin parent */ }
    const u = new URL(location.href); u.hash = ''; u.searchParams.delete('join'); u.searchParams.set('join', code);
    return u.toString();
  }
}
