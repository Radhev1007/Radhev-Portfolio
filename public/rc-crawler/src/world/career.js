// Career: XP, rank, achievements, trail completion and driving statistics, all from what the player actually does.
// Fed every frame with the truck's real state (speed, the surface under its tyres, water depth, upside-down time)
// and on events (medals, recoveries). Saved in localStorage (`rccrawler.career.v1`).
//
// XP: 1 per 10 m driven; medals 50 / 100 / 200 (bronze / silver / gold; an upgrade pays the difference);
// 2 per % of a terrain's trail newly reached; 100 per achievement.

const KEY = 'rccrawler.career.v1';
const MEDAL_XP = { bronze: 50, silver: 100, gold: 200 };
export const TERRAINS = ['desert', 'forest', 'mud', 'canyon', 'creek', 'ultimate'];
const VEHICLES = ['scx30', 'bronco', 'willys'];
const BRIDGE_M = 2, CREEK_M = 2.5;   // m driven on wood / through water that counts as crossing it

export const ACHIEVEMENTS = [
  { id: 'km1', name: 'First kilometre', desc: 'Drive 1 km', test: (c) => c.stats.distance >= 1000 },
  { id: 'km10', name: 'Long haul', desc: 'Drive 10 km', test: (c) => c.stats.distance >= 10000 },
  { id: 'hour', name: 'Seat time', desc: 'Drive for an hour', test: (c) => c.stats.time >= 3600 },
  { id: 'roll1', name: 'Shiny side down', desc: 'Roll the truck over', test: (c) => c.stats.rollovers >= 1 },
  { id: 'recover5', name: 'Regular customer', desc: 'Get recovered by the crane 5 times', test: (c) => c.stats.recoveries >= 5 },
  { id: 'bridge1', name: 'Plank walker', desc: 'Cross a plank bridge', test: (c) => c.stats.bridges >= 1 },
  { id: 'bridge10', name: 'Bridge builder', desc: 'Cross 10 plank bridges', test: (c) => c.stats.bridges >= 10 },
  { id: 'creek1', name: 'Wet feet', desc: 'Ford a creek', test: (c) => c.stats.creeks >= 1 },
  { id: 'creek10', name: 'Snorkel', desc: 'Ford 10 creeks', test: (c) => c.stats.creeks >= 10 },
  { id: 'medal1', name: 'On the podium', desc: 'Earn a medal', test: (c) => Object.keys(c.medals).length >= 1 },
  { id: 'gold1', name: 'Gold standard', desc: 'Earn a gold medal', test: (c) => Object.values(c.medals).includes('gold') },
  { id: 'medal15', name: 'All roads open', desc: 'Earn 15 medals: every terrain unlocked', test: (c) => Object.keys(c.medals).length >= 15 },
  { id: 'trail100', name: 'End of the trail', desc: 'Reach the end of a terrain\'s trail', test: (c) => Object.values(c.trail_).some((f) => f >= 0.97) },
  { id: 'explorer', name: 'Explorer', desc: 'Get halfway along every terrain\'s trail', test: (c) => TERRAINS.every((t) => (c.trail_[t] || 0) >= 0.5) },
  { id: 'garage', name: 'Full garage', desc: 'Drive 100 m in every vehicle', test: (c) => VEHICLES.every((v) => (c.vehicles[v]?.distance || 0) >= 100) },
];

/** Rank for an XP total: level 1 up, each level needing 250 XP more than the last. */
const TITLES = ['Rookie', 'Trail Hand', 'Rock Hopper', 'Crawler', 'Pathfinder', 'Expedition Lead', 'Summit Seeker', 'Trail Legend'];
export function rankFor(xp) {
  let level = 1, base = 0;
  while (xp >= base + 250 * level) { base += 250 * level; level++; }
  return { level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], into: xp - base, need: 250 * level };
}

/** How far along `path` the point is (0..1), or null when it is not on the trail (more than 3 m from it). */
export function trailFraction(path, p) {
  let best = Infinity, bi = 0;
  for (let i = 0; i < path.pts.length; i++) { const q = path.pts[i], d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < best) { best = d; bi = i; } }
  return best <= 9 ? bi / path.N : null;
}

const blank = () => ({
  xp: 0,
  stats: { distance: 0, time: 0, topSpeed: 0, rollovers: 0, recoveries: 0, bridges: 0, creeks: 0 },
  vehicles: {}, trail_: {}, medals: {}, unlocked: {},
});

export class Career {
  constructor(store) {
    this.store = store === undefined ? (() => { try { return globalThis.localStorage; } catch { return null; } })() : store;
    let saved = null;
    try { saved = JSON.parse(this.store?.getItem(KEY) || 'null'); } catch { /* corrupt or blocked: start fresh */ }
    Object.assign(this, blank(), saved || {});
    this.stats = { ...blank().stats, ...(saved?.stats || {}) };
    this.onUnlock = null; this.onRank = null;
    this._wood = 0; this._water = 0; this._rolled = false; this._dirty = 0;
  }

  get rank() { return rankFor(this.xp); }

  _xp(n) {
    if (n <= 0) return;
    const before = rankFor(this.xp).level;
    this.xp += n;
    const r = rankFor(this.xp);
    if (r.level > before) this.onRank?.(r);
  }

  /** One frame: s = { vehicle, level, speed (m/s), onWood, water (depth under the wheels), upsideTimer }. */
  update(dt, s) {
    const d = Math.abs(s.speed || 0) * dt, st = this.stats;
    const v = (this.vehicles[s.vehicle] ||= { distance: 0, time: 0, topSpeed: 0, rollovers: 0 });
    const tenths = Math.floor(st.distance / 10);
    st.distance += d; st.time += dt; v.distance += d; v.time += dt;
    st.topSpeed = Math.max(st.topSpeed, Math.abs(s.speed || 0)); v.topSpeed = Math.max(v.topSpeed, Math.abs(s.speed || 0));
    this._xp(Math.floor(st.distance / 10) - tenths);
    // a crossing counts when the truck has gone far enough on the planks or through the water, on leaving it
    if (s.onWood) this._wood += d; else { if (this._wood >= BRIDGE_M) st.bridges++; this._wood = 0; }
    if ((s.water || 0) > 0.3) this._water += d; else { if (this._water >= CREEK_M) st.creeks++; this._water = 0; }
    const rolled = (s.upsideTimer || 0) > 1.2;
    if (rolled && !this._rolled) { st.rollovers++; v.rollovers++; }
    this._rolled = rolled;
    this._check();
    this._dirty += dt;
    if (this._dirty > 5) this.save();
  }

  /** A medal for `key` (`<level>:<challenge>`): pays the difference over what this challenge has already paid. */
  medal(key, colour) {
    const had = MEDAL_XP[this.medals[key]] || 0, now = MEDAL_XP[colour] || 0;
    if (now <= had) return;
    this.medals[key] = colour;
    this._xp(now - had);
    this._check(); this.save();
  }

  /** Medals won before the career existed (challenges.js keeps them): counted, and paid, once. */
  syncMedals(best) {
    for (const [k, v] of Object.entries(best || {})) if (k.endsWith('#medal') && v) this.medal(k.slice(0, -6), v);
  }

  recovered() { this.stats.recoveries++; this._check(); this.save(); }

  /** The furthest the truck has been along a terrain's trail (0..1). */
  trail(level, frac) {
    const had = this.trail_[level] || 0;
    if (frac == null || frac <= had) return;
    this.trail_[level] = frac;
    this._xp(Math.floor(frac * 100) * 2 - Math.floor(had * 100) * 2);
    this._check();
  }

  _check() {
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked[a.id] || !a.test(this)) continue;
      this.unlocked[a.id] = Date.now();
      this._xp(100);
      this.onUnlock?.(a);
    }
  }

  save() {
    this._dirty = 0;
    const { xp, stats, vehicles, trail_, medals, unlocked } = this;
    try { this.store?.setItem(KEY, JSON.stringify({ xp, stats, vehicles, trail_, medals, unlocked })); } catch { /* storage blocked */ }
  }
}
