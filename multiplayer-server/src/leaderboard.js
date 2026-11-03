// Course leaderboards: the best result per player per course (`<map>:<challenge>:<mode>`), top 10. Results come
// only from times the room measured on the server clock (timed runs, race finishes), never from a client's own
// number. Kept across rooms in this process and saved to a JSON file (best effort: a host with no persistent disk
// starts a fresh board after a redeploy).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const TOP = 10;

// The garage's parts (public/rc-crawler/src/vehicles/parts.js), in code order. A player's parts travel as
// "tyres.shocks.motor.battery.esc.offset.acc+acc"; the first option of each is stock.
export const PART_IDS = {
  tyres: ['at', 'mt', 'sticky'], shocks: ['stock', 'soft', 'firm'], motor: ['t35', 't45', 't27'],
  battery: ['s2', 'mah5000', 's3'], esc: ['stock', 'crawl', 'sport'], offset: ['stock', 'narrow', 'wide'],
};
export const ACC_IDS = ['lightbar', 'rack', 'sliders', 'bumper'];
const LOOKS_ONLY = new Set(['lightbar', 'bumper']);

/** A parts code checked against the parts that exist: { code ('' if refused), stock (drives like stock) }. */
export function parseParts(code) {
  if (typeof code !== 'string' || code.length > 120) return { code: '', stock: true };
  const bits = code.split('.');
  if (bits.length !== 7) return { code: '', stock: true };
  const cats = Object.keys(PART_IDS);
  for (let i = 0; i < cats.length; i++) if (!PART_IDS[cats[i]].includes(bits[i])) return { code: '', stock: true };
  const acc = bits[6] ? bits[6].split('+') : [];
  if (acc.some((a) => !ACC_IDS.includes(a)) || new Set(acc).size !== acc.length) return { code: '', stock: true };
  const stock = cats.every((c, i) => bits[i] === PART_IDS[c][0]) && acc.every((a) => LOOKS_ONLY.has(a));
  return { code, stock };
}

export class Leaderboards {
  constructor(file) {
    this.file = file; this.boards = {}; this.timer = null;
    if (file) { try { this.boards = JSON.parse(readFileSync(file, 'utf8')) || {}; } catch { /* none yet */ } }
  }

  /** A result for `key`: kept if it is this player's best. Returns whether the board changed. */
  record(key, { guest, name, t, vehicle = 'scx30', stock = true }) {
    if (typeof key !== 'string' || !key || !guest || !Number.isFinite(t) || t <= 0) return false;
    const list = (this.boards[key] ||= []);
    const mine = list.find((e) => e.guest === guest);
    if (mine && mine.t <= t) return false;
    const e = { guest, name: String(name).slice(0, 24), t: Math.round(t), vehicle, stock: !!stock, at: Date.now() };
    if (mine) Object.assign(mine, e); else list.push(e);
    list.sort((a, b) => a.t - b.t);
    list.length = Math.min(list.length, TOP);
    this.save();
    return true;
  }

  /** The board for `key` as shown to players (no guest ids). */
  top(key) { return (this.boards[key] || []).map(({ guest, ...e }) => e); }

  save() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 2000);
    this.timer.unref?.();
  }

  flush() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.file) return;
    try { mkdirSync(dirname(this.file), { recursive: true }); writeFileSync(this.file, JSON.stringify(this.boards)); } catch (e) { console.warn('[boards] could not save', e.message); }
  }
}
