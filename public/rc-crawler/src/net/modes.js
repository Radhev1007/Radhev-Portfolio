// Multiplayer sessions on the existing terrains: Free Roam, Friends Race, Timed Obstacle Challenge,
// Stunt & Drift, Checkpoint Challenge and Co-op Off-Road. The server owns the clock, the course, progress
// and scores; this side places the local truck, shows the course, detects crossings and reports them.
// Single-player challenges and activities are untouched: these modes only run inside a room.
import * as THREE from 'three';

export const MODE_INFO = {
  free: { name: 'Free Roam', desc: 'Explore the map together. No timer, no scores.', course: null },
  race: { name: 'Friends Race', desc: 'Grid start, all gates in order, first to the finish wins.', course: 'gates' },
  timed: { name: 'Timed Obstacle Challenge', desc: 'Best clean run through an obstacle section in 4 minutes. Retry as often as you like.', course: 'activity' },
  stunt: { name: 'Stunt & Drift', desc: 'Score airtime and drifts for 3 minutes. Most points wins.', course: null },
  checkpoint: { name: 'Checkpoint Challenge', desc: 'Collect every checkpoint, in any order. First to all of them wins.', course: 'points' },
  coop: { name: 'Co-op Off-Road', desc: 'Get the team through every gate together. Anyone can take the next gate.', course: 'gates' },
};

const _fwd = new THREE.Vector3(), _side = new THREE.Vector3();
const crossed = (g, prev, cur) => {
  const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
  const d0 = (prev.x - g.x) * fx + (prev.z - g.z) * fz, d1 = (cur.x - g.x) * fx + (cur.z - g.z) * fz;
  const lat = Math.abs((cur.x - g.x) * fz - (cur.z - g.z) * fx);
  if (lat > g.width / 2 + 0.3) return false;
  return (d0 < 0 && d1 >= 0) || (d0 > 0 && d1 <= 0);
};

// a point `meters` along the trail from parameter t (negative = backwards), offset sideways
function alongPath(path, t, meters, lat) {
  const tt = THREE.MathUtils.clamp(t + meters / path.len, 0.002, 0.998);
  const p = path.offset(tt, lat);
  return { x: p.x, z: p.z, yaw: path.yaw(tt) };
}
function nearestT(path, x, z) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i <= path.N; i += 2) { const P = path.pts[i]; const d = (P.x - x) ** 2 + (P.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi / path.N;
}

export class Modes {
  constructor(mp, game) {
    this.mp = mp; this.game = game;
    this.session = -1; this.phase = 'lobby';
    this.course = null; this.visuals = null;
    this.prev = null; this.sent = {}; this.frozen = false;
    this.stunt = { pending: 0, sendT: 0, drift: 0, combo: 0 };
    this.usedChallenge = false;
  }

  // ---------- host: course options for the chosen mode on the loaded level
  courseOptions(mode) {
    const lvl = this.game.level();
    if (!lvl) return [];
    const kind = MODE_INFO[mode]?.course;
    const ch = lvl.challenges || [];
    if (kind === 'gates') {
      const opts = [];
      if (lvl.path) opts.push({ id: 'trail', name: 'Full trail (start to summit)' });
      for (const c of ch) if (c.gates?.length >= 2) opts.push({ id: c.id, name: c.name + (c.id.startsWith('act-') ? ' (obstacle section)' : '') });
      return opts;
    }
    // obstacle sections first (they are what this mode is for), then the terrain's own challenges
    if (kind === 'activity') return ch.filter((c) => c.gates?.length >= 2).sort((a, b) => b.id.startsWith('act-') - a.id.startsWith('act-'))
      .map((c) => ({ id: c.id, name: c.name + (c.tier !== undefined ? ` · ${['Beginner', 'Intermediate', 'Expert'][c.tier]}` : '') }));
    return [];
  }

  // ---------- host: the course geometry sent with Start (every client built the same level from the same seed)
  buildStartPayload(mode, challengeId) {
    const lvl = this.game.level();
    return { ...this.coursePayload(lvl, mode, challengeId), spawn: { x: lvl.spawn.x, z: lvl.spawn.z } };
  }
  coursePayload(lvl, mode, challengeId) {
    const kind = MODE_INFO[mode]?.course;
    if (kind === 'gates' || kind === 'activity') {
      if (challengeId === 'trail' && lvl.path) {
        const ts = [0.035, 0.16, 0.3, 0.44, 0.58, 0.72, 0.86, 0.975];
        return { gates: ts.map((t) => { const p = lvl.path.at(t); return { x: p.x, z: p.z, yaw: lvl.path.yaw(t), width: 5 }; }) };
      }
      const c = lvl.challenges.find((q) => q.id === challengeId);
      return c ? { gates: c.gates.map((g) => ({ x: g.x, z: g.z, yaw: g.yaw, width: g.width || 2.4 })) } : {};
    }
    if (kind === 'points') {
      const pts = [];
      if (lvl.path) for (let t = 0.08; t < 0.95; t += 0.045) { const p = lvl.path.offset(t, 0); pts.push({ x: p.x, z: p.z }); }
      for (const s of lvl.activities?.sites || []) pts.push({ x: s.cx, z: s.cz });
      return { points: pts };
    }
    return {};
  }

  // ---------- every state patch
  sync() {
    const st = this.mp.state, me = this.mp.me;
    if (!st || !me) return this.teardown();
    if (st.session !== this.session && (st.phase === 'countdown' || st.phase === 'running')) this.begin(st, me);
    if (st.phase !== this.phase) {
      const was = this.phase; this.phase = st.phase;
      if (st.phase === 'running' && was === 'countdown') { this.frozen = false; this.game.toast('GO!', MODE_INFO[st.mode]?.name || ''); this.game.sound('go'); }
      if (st.phase === 'results' || st.phase === 'lobby') this.end(st.phase);
    }
    this.refreshVisuals();
  }

  begin(st, me) {
    this.teardown();
    this.session = st.session; this.phase = st.phase;
    let c = null; try { c = st.course ? JSON.parse(st.course) : null; } catch { c = null; }
    this.course = c; this.sent = {}; this.prev = null;
    this.stunt = { pending: 0, sendT: 0, drift: 0, combo: 0 };
    const mode = st.mode;
    // where to start: a grid behind the first gate, otherwise spread out along the trail from the spawn
    const lvl = this.game.level();
    const order = this.mp.players.filter((x) => x.p.connected).sort((a, b) => a.p.slot - b.p.slot).findIndex((x) => x.sid === this.mp.room.sessionId);
    const k = Math.max(0, order);
    let pose;
    if (c?.gates?.length && me.status === 'driving') pose = this.gridPose(c.gates[0], k);
    else pose = this.spawnPose(k);
    this.game.placeAt(pose.x, pose.z, pose.yaw);
    this.mp.flagRecover();
    this.frozen = mode !== 'free' && st.phase === 'countdown';
    if (mode === 'timed' && st.challenge) { this.game.selectChallenge(st.challenge); this.usedChallenge = true; }
    this.buildVisuals(mode, c);
  }

  end(phase) {
    this.frozen = false;
    if (this.usedChallenge) { this.game.selectChallenge(null); this.usedChallenge = false; }
    if (phase === 'lobby') this.clearVisuals();
  }

  teardown() { this.end('lobby'); this.session = this.mp.state ? this.session : -1; this.course = null; }

  gridPose(g, k) {
    const lvl = this.game.level(), row = Math.floor(k / 2), lat = (k % 2 ? -1 : 1) * 0.9;
    const back = 2.6 + row * 2.6;
    if (lvl.path) {
      const t = nearestT(lvl.path, g.x, g.z);
      const P = lvl.path.at(t);
      if (Math.hypot(P.x - g.x, P.z - g.z) < 3) return alongPath(lvl.path, t, -back, lat);
    }
    const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
    return { x: g.x - fx * back + fz * lat, z: g.z - fz * back - fx * lat, yaw: g.yaw };
  }

  spawnPose(k) {
    const lvl = this.game.level(), s = lvl.spawn;
    if (!k || !lvl.path) return { x: s.x, z: s.z, yaw: s.yaw };
    const t = nearestT(lvl.path, s.x, s.z);
    return alongPath(lvl.path, t, 1.5 + Math.floor(k / 2) * 2.8, (k % 2 ? -1 : 1) * 0.9);
  }

  // recovery inside a session: back to the last gate passed (race / co-op), else the normal behaviour
  recoverPose() {
    const st = this.mp.state, me = this.mp.me, c = this.course;
    if (!st || !me || !c?.gates || (st.phase !== 'running' && st.phase !== 'countdown')) return null;
    if (st.mode !== 'race' && st.mode !== 'coop') return null;
    const i = st.mode === 'race' ? Math.max(0, me.cp) : Math.max(0, st.team - 1);
    const g = c.gates[i], fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
    return i === 0 && me.cp < 0 ? this.gridPose(g, 0) : { x: g.x + fx * 1.2, z: g.z + fz * 1.2, yaw: g.yaw };
  }

  inputOverride(inp) { return this.frozen ? { throttle: 0, steer: 0, handbrake: true } : inp; }

  // existing single-player challenge events, used as-is for the timed mode
  onChallengeEvent(type, c, a) {
    const st = this.mp.state;
    if (!st || st.mode !== 'timed' || st.phase !== 'running' || !c || c.id !== st.challenge) return;
    if (type === 'start') this.mp.room.send('cp', { i: 0 });
    if (type === 'checkpoint') this.mp.room.send('cp', { i: a + 1 });
    if (type === 'complete') this.mp.room.send('cp', { i: c.gates.length - 1 });
    if (type === 'fail') this.mp.room.send('runFail');
  }

  // ---------- per frame (after the local physics step)
  update(dt, phys) {
    const st = this.mp.state, me = this.mp.me, room = this.mp.room;
    if (!st || !me || !room) return;
    const cur = { x: phys.pos.x, z: phys.pos.z }, prev = this.prev || cur; this.prev = cur;
    if (st.phase !== 'running' || me.status !== 'driving') return;
    const c = this.course, now = performance.now();
    const once = (key, gap = 400) => { if (now - (this.sent[key] || 0) < gap) return false; this.sent[key] = now; return true; };

    if (st.mode === 'race' && c?.gates) {
      const i = me.cp + 1, g = c.gates[i];
      if (g && crossed(g, prev, cur) && once('g' + i)) room.send('cp', { i });
    } else if (st.mode === 'coop' && c?.gates) {
      const g = c.gates[st.team];
      if (g && crossed(g, prev, cur) && once('t' + st.team)) room.send('cp', { i: st.team });
    } else if (st.mode === 'checkpoint' && c?.points) {
      c.points.forEach((p, i) => {
        if (me.mask & (1 << i)) return;
        if (Math.hypot(cur.x - p.x, cur.z - p.z) < 3 && once('p' + i, 600)) room.send('cp', { i });
      });
    } else if (st.mode === 'stunt') {
      this.scoreStunts(dt, phys, now);
    }
  }

  // drifts: sideways speed while driving on the ground; airtime: from the physics' own landing events
  scoreStunts(dt, phys, now) {
    const s = this.stunt;
    const fwd = _fwd.set(0, 0, 1).applyQuaternion(phys.q), side = _side.set(1, 0, 0).applyQuaternion(phys.q);
    const speed = Math.abs(phys.vel.dot(fwd)), slide = Math.abs(phys.vel.dot(side));
    if (phys.stats.grounded >= 0.5 && speed > 1.5 && slide > 0.6) { s.drift += slide * speed * dt * 14; }
    else if (s.drift > 0) { if (s.drift > 40) this.game.toast(`Drift +${Math.round(s.drift)}`, ''); s.pending += s.drift; s.drift = 0; }
    for (const e of phys.events) {
      if (e.type === 'land' && e.air > 0.3 && phys.upsideTimer < 0.2) {
        const pts = Math.round(e.air * 260);
        s.pending += pts; this.game.toast(`Air ${e.air.toFixed(1)}s +${pts}`, '');
      }
    }
    if (s.pending >= 1 && now - s.sendT > 500) { this.mp.room.send('score', { pts: Math.round(s.pending) }); s.pending = 0; s.sendT = now; }
  }

  // ---------- course visuals: gate arches (next one bright) and checkpoint beacons
  buildVisuals(mode, c) {
    this.clearVisuals();
    if (!c || mode === 'timed') return;
    const scene = this.game.scene(), hf = this.game.level().hf;
    const group = new THREE.Group(); group.name = 'mp-course';
    const items = [];
    const mat = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false });
    if (c.gates) {
      for (const g of c.gates) {
        const a = new THREE.Group();
        const y = hf.heightAt(g.x, g.z);
        const post = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8);
        const m = mat(0xff7a1a, 0.9);
        for (const sg of [-1, 1]) { const p = new THREE.Mesh(post, m); p.position.set(sg * g.width / 2, 1.1, 0); a.add(p); }
        const band = new THREE.Mesh(new THREE.PlaneGeometry(g.width, 0.32), mat(0xff7a1a, 0.55)); band.position.y = 2.05; a.add(band);
        a.position.set(g.x, y, g.z); a.rotation.y = g.yaw;
        group.add(a); items.push({ obj: a, m, band: band.material });
      }
    } else if (c.points) {
      for (const p of c.points) {
        const y = hf.heightAt(p.x, p.z);
        const m = mat(0x3fd0ff, 0.35);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 20, 1, true), m);
        b.position.set(p.x, y + 3, p.z);
        group.add(b); items.push({ obj: b, m });
      }
    }
    scene.add(group);
    this.visuals = { group, items, kind: c.gates ? 'gates' : 'points' };
  }

  refreshVisuals() {
    const v = this.visuals, st = this.mp.state, me = this.mp.me;
    if (!v || !st || !me) return;
    if (v.kind === 'gates') {
      const next = st.mode === 'coop' ? st.team : me.cp + 1;
      v.items.forEach((it, i) => {
        const on = i === next, done = i < next;
        it.obj.visible = !done;
        it.m.opacity = on ? 0.95 : 0.35; it.band.opacity = on ? 0.6 : 0.18;
        it.m.color.setHex(i === v.items.length - 1 ? 0x37d67a : 0xff7a1a);
      });
    } else v.items.forEach((it, i) => { it.obj.visible = !(me.mask & (1 << i)); });
  }

  clearVisuals() {
    if (!this.visuals) return;
    this.game.scene().remove(this.visuals.group);
    this.visuals.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    this.visuals = null;
  }

  // ---------- standings for the HUD and results
  standings() {
    const st = this.mp.state;
    if (!st) return [];
    const rows = this.mp.players.map(({ sid, p }) => ({ sid, p }));
    const by = {
      race: (a, b) => (b.p.finish > 0) - (a.p.finish > 0) || (a.p.finish && b.p.finish ? a.p.finish - b.p.finish : b.p.cp - a.p.cp),
      timed: (a, b) => (b.p.best > 0) - (a.p.best > 0) || a.p.best - b.p.best,
      stunt: (a, b) => b.p.score - a.p.score,
      checkpoint: (a, b) => b.p.score - a.p.score || (a.p.finish || 1e12) - (b.p.finish || 1e12),
      coop: (a, b) => b.p.score - a.p.score,
      free: (a, b) => a.p.slot - b.p.slot,
    }[st.mode] || (() => 0);
    return rows.filter((r) => r.p.status !== 'spectating' || st.mode === 'free').sort(by);
  }
}
