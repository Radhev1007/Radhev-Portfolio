// Gateways: the arches that join the hub (Trailhead Valley) to the terrains.
//
// A gateway is { id, to, x, z, yaw, width }: an arch across a trail at (x, z), with `yaw` the direction you
// drive to leave through it and `width` the opening. The hub has one per terrain; every terrain has one
// return gateway, just behind its spawn, back to the hub.
import * as THREE from 'three';
import { smoothstep, lerp } from '../core/noise.js';
import { LEVEL_BY_ID } from '../levels/levels.js';
import { isUnlocked, needFor, medalsIn, countMedals, availableIn } from './progress.js';

const MIN_SPEED = 0.2;   // m/s forward: rolling or reversing through an arch never travels
const MIN_UP = 0.6;      // the truck must be roughly upright

/**
 * Did the truck pass out through gateway `g` between `prev` and `cur` (world x/z)? Only an outward
 * crossing within the opening, driving forward and upright, counts.
 */
export function crossedGateway(g, prev, cur, fwdSpeed, upY) {
  if (fwdSpeed <= MIN_SPEED || upY <= MIN_UP) return false;
  const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
  const d0 = (prev.x - g.x) * fx + (prev.z - g.z) * fz, d1 = (cur.x - g.x) * fx + (cur.z - g.z) * fz;
  if (!(d0 < 0 && d1 >= 0)) return false;
  const lat = (cur.x - g.x) * fz - (cur.z - g.z) * fx;
  return Math.abs(lat) <= g.width / 2;
}

/**
 * The return gateway for a terrain: 4 m behind its spawn, facing away from it, on a pad levelled to the
 * spawn's height (2.5 m round, easing back into the ground over 2 m). Coming back from the hub you arrive
 * at the spawn as usual.
 */
export function placeReturnGateway(ctx, spawn) {
  const hf = ctx.hf;
  const x = spawn.x - Math.sin(spawn.yaw) * 4, z = spawn.z - Math.cos(spawn.yaw) * 4;
  const y = hf.baseHeightAt(spawn.x, spawn.z);
  ctx.forEachNear(x, z, 4.5, (k, px, pz, d) => { hf.base[k] = lerp(y, hf.base[k], smoothstep(2.5, 4.5, d)); });
  return { gateway: { id: 'return', to: 'hub', x, z, yaw: spawn.yaw + Math.PI, width: 3.2 }, arrival: spawn };
}

// ------------------------------------------------------------------ the arches in the scene
const ARCH_H = 2.4, POST = 0.12, BARRIER_POSTS = 5;
const stars = (n) => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(Math.max(0, 5 - Math.round(n || 0)));

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { c, t };
}

function drawSign({ c, t }, lines, locked) {
  const g = c.getContext('2d');
  g.fillStyle = locked ? '#2a2422' : '#1d2a1f'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = locked ? '#8a6a52' : '#c9b27a'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#f2ead8'; g.font = '600 46px system-ui, sans-serif'; g.fillText(lines[0], c.width / 2, 48);
  g.fillStyle = locked ? '#f0a070' : '#d8c890'; g.font = '500 30px system-ui, sans-serif';
  if (lines[1]) g.fillText(lines[1], c.width / 2, 100);
  if (lines[2]) { g.font = '500 24px system-ui, sans-serif'; g.fillText(lines[2], c.width / 2, 136); }
  t.needsUpdate = true;
}

/**
 * The sign's text for gateway `g` with progress `best`, and whether the way is barred. In a multiplayer room
 * nothing is barred (players' own unlocks differ, and the room shares one physics world) and the sign says so.
 */
function signFor(g, best, multiplayer) {
  const def = LEVEL_BY_ID[g.to];
  const name = g.to === 'hub' ? 'Trailhead Valley' : def ? def.name : g.to;
  if (multiplayer) return { lines: [name, 'Multiplayer room', 'Gateways open when you leave the room'], locked: false };
  if (g.to === 'hub') return { lines: ['Trailhead Valley', 'Back to basecamp'], locked: false };
  const avail = availableIn(g.to);
  const tally = `Medals ${medalsIn(best, g.to)} / ${avail ?? '—'}`;
  if (!isUnlocked(g.to, best)) return { lines: [name, `Earn ${needFor(g.to)} medals · you have ${countMedals(best)}`, stars(def?.stars)], locked: true };
  return { lines: [name, `${stars(def?.stars)}   ${tally}`], locked: false };
}

/**
 * Arches, signs and (for locked terrains) barriers for every gateway of `level`, plus the hub's basecamp
 * props. `posts` must join level.posts before the physics starts. Each frame, `update` returns the gateway
 * the truck just drove out through (open ones only); pushing against a barrier sets `lastBlocked`.
 */
export function buildGateways(level, best, opts = {}) {
  const group = new THREE.Group(); group.name = 'gateways';
  const hf = level.hf, posts = [];
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.45, metalness: 0.6 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xc8352a, roughness: 0.6 });
  const postGeo = new THREE.BoxGeometry(POST, ARCH_H, POST); postGeo.translate(0, ARCH_H / 2, 0);
  const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8); barGeo.translate(0, 0.45, 0);
  const list = [];
  for (const g of level.gateways || []) {
    const y = hf.heightAt(g.x, g.z) - 0.04;
    const arch = new THREE.Group();
    arch.position.set(g.x, y, g.z); arch.rotation.y = g.yaw;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(postGeo, wood); p.position.x = sx * g.width / 2; p.castShadow = true; arch.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(g.width + 0.5, 0.16, 0.16), wood); beam.position.y = ARCH_H; beam.castShadow = true; arch.add(beam);
    const tex = signTexture();
    const signMat = new THREE.MeshStandardMaterial({ map: tex.t, roughness: 0.7 });
    for (const face of [0, Math.PI]) {    // readable from both sides
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.69), signMat);
      sg.position.set(0, ARCH_H + 0.48, face ? 0.03 : -0.03); sg.rotation.y = face + Math.PI;
      arch.add(sg);
    }
    group.add(arch);
    // the arch's own posts are solid
    const across = (d) => ({ x: g.x + Math.cos(g.yaw) * d, z: g.z - Math.sin(g.yaw) * d });
    for (const sx of [-1, 1]) { const q = across(sx * g.width / 2); posts.push({ x: q.x, z: q.z, r: POST * 0.7, y0: y, top: y + ARCH_H, mat: 'wood', kind: 'arch' }); }
    // barrier: steel bollards across the opening, solid while the terrain is locked
    const barrier = [];
    for (let k = 0; k < BARRIER_POSTS; k++) {
      const d = (k / (BARRIER_POSTS - 1) - 0.5) * (g.width - 0.5);
      const q = across(d);
      const m = new THREE.Group();
      const b = new THREE.Mesh(barGeo, steel); b.castShadow = true;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 8), stripe); st.position.y = 0.72;
      m.add(b, st); m.position.set(q.x, hf.heightAt(q.x, q.z) - 0.04, q.z);
      group.add(m);
      const post = { x: q.x, z: q.z, r: 0.04, y0: m.position.y, top: m.position.y + 0.9, mat: 'steel', kind: 'barrier', enabled: true, mesh: m, gateway: g };
      posts.push(post); barrier.push(post);
    }
    list.push({ g, tex, barrier });
  }
  if (level.basecamp) buildBasecamp(level, group, posts);

  const api = {
    group, posts, list, lastBlocked: null,
    multiplayer: !!opts.multiplayer,
    refresh(b, o) {
      if (o && 'multiplayer' in o) api.multiplayer = !!o.multiplayer;
      for (const it of list) {
        const { lines, locked } = signFor(it.g, b, api.multiplayer);
        drawSign(it.tex, lines, locked);
        it.locked = locked;
        for (const p of it.barrier) { p.enabled = locked; p.mesh.visible = locked; }
      }
    },
    update(prev, cur, phys) {
      api.lastBlocked = null;
      for (const it of list) {
        if (it.locked) { if (it.barrier.some((p) => phys.touched.has(p))) api.lastBlocked = it.g; continue; }
        if (crossedGateway(it.g, prev, cur, phys.stats.speed, phys.up.y)) return it.g;
      }
      return null;
    },
  };
  api.refresh(best);
  return api;
}

// Basecamp: a tent, a flagpole and the progress board (its face is drawn by `drawBoard`).
function buildBasecamp(level, group, posts) {
  const bc = level.basecamp, hf = level.hf;
  const at = (p) => hf.heightAt(p.x, p.z) - 0.03;
  // tent: a ridge tent of canvas over two poles
  const tent = new THREE.Group();
  const canvas = new THREE.MeshStandardMaterial({ color: 0xb8643a, roughness: 0.9, side: THREE.DoubleSide });
  const shape = new THREE.Shape([new THREE.Vector2(-1.1, 0), new THREE.Vector2(1.1, 0), new THREE.Vector2(0, 1.4)]);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }), canvas);
  body.position.z = -1.1; body.castShadow = true; body.receiveShadow = true;
  tent.add(body);
  tent.position.set(bc.tent.x, at(bc.tent), bc.tent.z); tent.rotation.y = 0.5;
  group.add(tent);
  posts.push({ x: bc.tent.x, z: bc.tent.z, r: 1.0, y0: tent.position.y, top: tent.position.y + 1.4, mat: 'wood', kind: 'prop' });
  // flagpole with a pennant
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.7, roughness: 0.3 }));
  pole.position.set(bc.flag.x, at(bc.flag) + 2, bc.flag.z); pole.castShadow = true;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshStandardMaterial({ color: 0xf4a018, roughness: 0.7, side: THREE.DoubleSide }));
  flag.position.set(bc.flag.x + 0.58, at(bc.flag) + 3.55, bc.flag.z); flag.userData.flag = true;
  group.add(pole, flag);
  posts.push({ x: bc.flag.x, z: bc.flag.z, r: 0.06, y0: pole.position.y - 2, top: pole.position.y + 2, mat: 'metal', kind: 'prop' });
  // progress board on two legs
  const board = new THREE.Group();
  const tex = signTexture(); tex.c.height = 320; tex.t.needsUpdate = true;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: tex.t, roughness: 0.8 }));
  face.position.y = 1.55; board.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.6, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 }));
  back.position.set(0, 1.55, -0.04); back.castShadow = true; board.add(back);
  for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a3a2a })); leg.position.set(sx * 1.05, 0.4, -0.04); board.add(leg); }
  board.position.set(bc.board.x, at(bc.board), bc.board.z); board.rotation.y = bc.board.yaw;
  group.add(board);
  for (const sx of [-1, 1]) posts.push({ x: bc.board.x + Math.cos(bc.board.yaw) * sx * 1.05, z: bc.board.z - Math.sin(bc.board.yaw) * sx * 1.05, r: 0.06, y0: board.position.y, top: board.position.y + 2.4, mat: 'wood', kind: 'prop' });
  group.userData.board = tex;
}

/** Fill basecamp's progress board: a title and one row per terrain ([name, text]). */
export function drawBoard(gw, rows, total) {
  const tex = gw.group.userData.board; if (!tex) return;
  const { c, t } = tex, g = c.getContext('2d');
  g.fillStyle = '#1d2a1f'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#c9b27a'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = '#f2ead8'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('TRAILHEAD VALLEY', 26, 36);
  g.textAlign = 'right'; g.fillStyle = '#d8c890'; g.fillText(`Medals ${total}`, c.width - 26, 36);
  g.font = '500 24px system-ui, sans-serif';
  rows.forEach(([name, text, locked], i) => {
    const y = 84 + i * 34;
    g.textAlign = 'left'; g.fillStyle = locked ? '#9a8a7a' : '#f2ead8'; g.fillText(name, 26, y);
    g.textAlign = 'right'; g.fillStyle = locked ? '#f0a070' : '#d8c890'; g.fillText(text, c.width - 26, y);
  });
  t.needsUpdate = true;
}
