// Optional objectives: ordered gates (start -> checkpoints -> finish) with rules
// noRollover / noStop / noTouch (stakes). One challenge active at a time.

const BEST_KEY = 'rccrawler.best.v1';
function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; } }
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* ignore */ } }

export class ChallengeManager {
  constructor(onEvent) {
    this.onEvent = onEvent;
    this.list = []; this.active = null; this.state = 'idle';
    this.best = loadBest();
  }

  setLevel(level) {
    this.level = level;
    this.list = level.challenges;
    this.stakes = level.markers.filter((m) => m.type === 'stake');
    this.active = null; this.state = 'idle';
  }

  bestFor(c) { return this.best[this.level.def.id + ':' + c.id]; }

  select(id) {
    this.active = this.list.find((c) => c.id === id) || null;
    this.state = this.active ? 'armed' : 'idle';
    this.next = 0; this.time = 0; this.stopT = 0;
    this.onEvent('select', this.active);
  }

  fail(reason) {
    this.state = 'armed'; this.next = 0; this.time = 0;
    this.onEvent('fail', this.active, reason);
  }

  // returns true when the car crossed gate g between prev and cur positions
  _crossed(g, prev, cur) {
    const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
    const d0 = (prev.x - g.x) * fx + (prev.z - g.z) * fz, d1 = (cur.x - g.x) * fx + (cur.z - g.z) * fz;
    const lat = Math.abs((cur.x - g.x) * fz - (cur.z - g.z) * fx);
    if (g.yaw === 0 && g.width && g.isPoint) return false;
    // allow crossing in either direction for point-like finish markers
    if (lat > g.width / 2 + 0.3) return false;
    return (d0 < 0 && d1 >= 0) || (d0 > 0 && d1 <= 0) || Math.hypot(cur.x - g.x, cur.z - g.z) < Math.min(1.0, g.width / 2);
  }

  update(dt, phys) {
    const c = this.active;
    const cur = { x: phys.pos.x, z: phys.pos.z };
    const prev = this.prev || cur; this.prev = cur;
    if (!c) return;
    const gates = c.gates;
    if (this.state === 'armed') {
      if (this._crossed(gates[0], prev, cur)) { this.state = 'running'; this.time = 0; this.next = 1; this.stopT = 0; this.onEvent('start', c); }
      return;
    }
    if (this.state !== 'running') return;
    this.time += dt;
    // rules
    if (c.rules.noRollover && phys.upsideTimer > 0.4) return this.fail('Rolled over');
    if (c.rules.noStop) {
      if (Math.abs(phys.stats.speed) < 0.12) this.stopT += dt; else this.stopT = 0;
      if (this.stopT > 1.2) return this.fail('Stopped in the creek');
    }
    if (c.rules.noTouch) {
      const pts = phys.cornerPoints();
      for (const s of this.stakes) {
        if (s.id !== c.id) continue;
        if (Math.abs(s.x - cur.x) > 2 || Math.abs(s.z - cur.z) > 2) continue;
        for (const p of pts) if (Math.hypot(p.x - s.x, p.z - s.z) < 0.09) return this.fail('Touched a marker');
      }
    }
    const g = gates[this.next];
    if (g && this._crossed(g, prev, cur)) {
      this.next++;
      if (this.next >= gates.length) {
        this.state = 'done';
        const key = this.level.def.id + ':' + c.id;
        const isBest = !this.best[key] || this.time < this.best[key];
        if (isBest) { this.best[key] = this.time; saveBest(this.best); }
        this.onEvent('complete', c, this.time, isBest);
      } else this.onEvent('checkpoint', c, this.next - 1, gates.length - 2);
    }
  }
}

export function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
