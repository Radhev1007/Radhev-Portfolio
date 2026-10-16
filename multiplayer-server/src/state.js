// Shared room state, synchronised to every client by Colyseus (delta-encoded patches, ~10 Hz).
// Only lobby, session and scoring data lives here: vehicle movement is high-frequency and goes
// through the compact binary snapshots in shared/codec.js instead.
import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';

export class Player extends Schema {
  constructor() {
    super();
    this.name = '';
    this.color = 0;          // index into the shared livery palette (the vehicle identifier in the lobby)
    this.slot = 0;           // 0..19, the id used in binary snapshots
    this.ready = false;
    this.host = false;
    this.connected = true;
    this.joinedAt = 0;
    this.ping = 0;
    this.status = 'lobby';   // lobby | driving | finished | spectating
    this.cp = -1;            // last gate passed this run / race
    this.mask = 0;           // checkpoint mode: collected points (bit per point)
    this.score = 0;          // stunt points, checkpoints collected, coop gates credited
    this.finish = 0;         // race / checkpoint finish time, ms after the start (0 = not finished)
    this.best = 0;           // timed challenge: best run, ms (0 = none yet)
    this.runs = 0;
    this.voice = false;      // joined the voice room
    this.mic = false;        // microphone published and unmuted
    this.vmode = '';         // voice transport: 'lk' (LiveKit) | 'p2p' (direct) | '' (not in voice)
    this.vehicle = 'scx30';  // body shell on the shared RC chassis (looks only: physics are the same for all)
  }
}
defineTypes(Player, {
  name: 'string', color: 'uint8', slot: 'uint8', ready: 'boolean', host: 'boolean', connected: 'boolean',
  joinedAt: 'number', ping: 'uint16', status: 'string', cp: 'int8', mask: 'uint32', score: 'number',
  finish: 'number', best: 'number', runs: 'uint16', voice: 'boolean', mic: 'boolean', vmode: 'string', vehicle: 'string',
});

export class RoomState extends Schema {
  constructor() {
    super();
    this.code = '';
    this.map = 'creek';
    this.mode = 'free';          // free | race | timed | stunt | checkpoint | coop
    this.challenge = '';         // the level challenge the course comes from (race / timed / coop)
    this.phase = 'lobby';        // lobby | countdown | running | results
    this.startAt = 0;            // server ms
    this.endAt = 0;              // server ms, 0 = open-ended
    this.course = '';            // JSON: { gates:[{x,z,yaw,width}] } or { points:[{x,z}] }
    this.team = 0;               // coop: next gate the team needs
    this.teamTime = 0;           // coop: finish time, ms
    this.session = 0;            // increments on every start, so clients can tell sessions apart
    this.players = new MapSchema();
    this.broken = new ArraySchema();   // indices into level.posts that have been snapped this session
  }
}
defineTypes(RoomState, {
  code: 'string', map: 'string', mode: 'string', challenge: 'string', phase: 'string', startAt: 'number', endAt: 'number',
  course: 'string', team: 'int16', teamTime: 'number', session: 'uint16', players: { map: Player }, broken: ['uint16'],
});
