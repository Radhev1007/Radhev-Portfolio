// The crowd: spectators standing at every challenge start, at the gateways and round basecamp, the way a
// rally stage draws people. They are drawn as a few instanced meshes (body, head, two arms), sized to the
// truck (about 0.9 m tall), and they react to it:
//   - face the truck while it is within 30 m
//   - cheer (bounce, arms up) for a landed jump nearby, a challenge start or finish
//   - flinch (duck) when it rolls over near them
//   - step out of the way when it comes at them, drifting back once it has passed
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// The spectators are a photogrammetry scan: AR+MR's "People of Los Angeles #3" (CC BY 4.0, credited in Help),
// cut from its pavement, simplified to 6,000 triangles and compressed (140 KB from 16.7 MB), feet at the
// origin and height 1. Until it has loaded (or if it cannot), simple figures stand in.
export const CROWD_CREDIT = { title: 'People of Los Angeles #3', author: 'AR+MR', changes: 'cut from its pavement, simplified', url: 'https://sketchfab.com/3d-models/people-of-los-angeles-3-0fb338ee68f048b8a6945d2937120a9d', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };
const SPECTATOR_URL = 'assets/spectator.glb';
const DRAW_R = 45;   // m from the camera: further away nobody is drawn
let scanPromise = null;
function loadSpectator() {
  if (typeof window === 'undefined') return Promise.resolve(null);   // headless (tests): the stand-ins only
  if (!scanPromise) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    scanPromise = loader.loadAsync(SPECTATOR_URL).then((g) => {
      let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) return null;
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();   // the cut-out carries none
      // the scan has its light baked in; a matte standard material still takes the scene's light and shadow
      const material = new THREE.MeshStandardMaterial({ map: mesh.material.map, roughness: 1, metalness: 0, side: THREE.DoubleSide });
      return { geometry: mesh.geometry, material };
    }).catch((err) => { console.warn('[crowd] spectator scan failed to load; using the stand-ins', err); return null; });
  }
  return scanPromise;
}

const SHIRTS = [0xd94f3d, 0x2f6fd0, 0xf2b632, 0x3ea65f, 0xeeeeee, 0x222831, 0x8e44ad, 0xe67e22, 0x16a085, 0xc0392b];
const TROUSERS = [0x2b3442, 0x3b3b3b, 0x4a3b2c, 0x1f2a44, 0x5a5f66];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const H = 0.9;                       // standing height, to the truck's scale
const SEE = 30, CHEER_R = 25, FLINCH_R = 20, DODGE_R = 2.2;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

/** Where people stand: a group either side of each challenge start, at each gateway and round basecamp. */
export function crowdSpots(level, rings, rng = Math.random) {
  const spots = [];
  const add = (x, z, face) => spots.push({ x, z, face });
  for (const r of rings) {
    const g = r.c.gates[0], fx = Math.sin(g.yaw), fz = Math.cos(g.yaw), px = fz, pz = -fx;
    for (const side of [-1, 1]) {
      const n = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const lat = side * (r.r + 2.6 + rng() * 1.6), along = (k - n / 2) * 0.7 + (rng() - 0.5) * 0.4;
        add(r.x + px * lat + fx * along, r.z + pz * lat + fz * along, Math.atan2(r.x - (r.x + px * lat), r.z - (r.z + pz * lat)));
      }
    }
  }
  for (const g of level.gateways || []) {
    const px = Math.cos(g.yaw), pz = -Math.sin(g.yaw);
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const lat = side * (g.width / 2 + 1.4 + k * 0.7), back = -1.5 - rng() * 1.5;
      const x = g.x + px * lat + Math.sin(g.yaw) * back, z = g.z + pz * lat + Math.cos(g.yaw) * back;
      add(x, z, Math.atan2(g.x - x, g.z - z));
    }
  }
  if (level.basecamp) {
    const b = level.basecamp;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + rng() * 0.3, d = b.r - 1.5 + rng() * 1.5;
      const x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
      add(x, z, Math.atan2(b.x - x, b.z - z));
    }
  }
  const hf = level.hf;
  return spots.filter((s) => {
    if (Math.abs(s.x) > hf.half - 3 || Math.abs(s.z) > hf.half - 3) return false;
    if (hf.waterDepthAt?.(s.x, s.z) > 0.05) return false;
    return hf.normalAt(s.x, s.z, _p).y > 0.82;    // nobody stands on a steep bank
  });
}

/** Instanced spectators for `level`; `update` animates them against the truck each frame. */
export function buildCrowd(level, rings) {
  const spots = crowdSpots(level, rings);
  const n = spots.length, group = new THREE.Group(); group.name = 'crowd';
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  // legs (trousers) 0-0.36 m, torso (shirt) 0.34-0.70, head at 0.81, arms hung from the shoulders at 0.66
  const leg = (x) => { const g = new THREE.CapsuleGeometry(0.045, 0.27, 2, 6); g.translate(x, 0.18, 0); return g; };
  const legsGeo = mergeGeometries([leg(0.055), leg(-0.055)]);
  const bodyGeo = new THREE.CapsuleGeometry(0.1, 0.17, 3, 8); bodyGeo.scale(1, 1, 0.72); bodyGeo.translate(0, 0.52, 0);
  const headGeo = new THREE.SphereGeometry(0.085, 10, 8); headGeo.translate(0, 0.81, 0);
  const armGeo = new THREE.CapsuleGeometry(0.032, 0.24, 2, 6); armGeo.translate(0, -0.14, 0);   // pivots at the shoulder
  const body = new THREE.InstancedMesh(bodyGeo, mat, n), head = new THREE.InstancedMesh(headGeo, mat, n);
  const legs = new THREE.InstancedMesh(legsGeo, mat, n);
  const armL = new THREE.InstancedMesh(armGeo, mat, n), armR = new THREE.InstancedMesh(armGeo, mat, n);
  for (const m of [body, head, legs, armL, armR]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  const c = new THREE.Color();
  const people = spots.map((s, i) => {
    const shirt = SHIRTS[(i * 7 + Math.floor(Math.random() * 3)) % SHIRTS.length];
    body.setColorAt(i, c.setHex(shirt)); armL.setColorAt(i, c); armR.setColorAt(i, c);
    head.setColorAt(i, c.setHex(SKIN[Math.floor(Math.random() * SKIN.length)]));
    legs.setColorAt(i, c.setHex(TROUSERS[Math.floor(Math.random() * TROUSERS.length)]));
    return { ...s, ox: 0, oz: 0, yaw: s.face, cheer: 0, flinch: 0, phase: Math.random() * 6.28, scale: 0.92 + Math.random() * 0.16 };
  });
  for (const m of [body, head, legs, armL, armR]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  const hf = level.hf;
  let t = 0, scan = null;
  const stand = [body, head, legs, armL, armR];
  loadSpectator().then((sc) => {
    if (!sc) return;
    scan = new THREE.InstancedMesh(sc.geometry, sc.material, n);
    scan.castShadow = true; scan.receiveShadow = true; scan.frustumCulled = false;
    group.add(scan);
    for (const m of stand) m.visible = false;
  });

  const near = (p, r) => people.filter((q) => Math.hypot(q.x + q.ox - p.x, q.z + q.oz - p.z) < r);
  const api = {
    group, people,
    /** Everyone within `r` m of `p` cheers for `secs`. */
    cheer(p, r = CHEER_R, secs = 2.5) { for (const q of near(p, r)) q.cheer = Math.max(q.cheer, secs * (0.7 + Math.random() * 0.5)); },
    flinch(p, r = FLINCH_R) { for (const q of near(p, r)) q.flinch = 1.2 + Math.random() * 0.4; },
    /** React to the truck's physics events (landings) this frame. */
    events(evts) { for (const e of evts) if (e.type === 'land' && e.air > 0.4 && e.p) api.cheer(e.p, CHEER_R, 1.5 + Math.min(2, e.air)); },
    update(dt, truck, vel, eye) {
      t += dt;
      let j = 0;   // drawn slots: only people near the camera are drawn
      for (let i = 0; i < n; i++) {
        const q = people[i];
        // step aside from a truck coming at us, drift back when it has gone
        if (truck) {
          const dx = q.x + q.ox - truck.x, dz = q.z + q.oz - truck.z, d = Math.hypot(dx, dz);
          const closing = vel ? (dx * vel.x + dz * vel.z) / Math.max(d, 0.01) : 0;   // > 0: the truck is coming our way
          if (d < DODGE_R && closing > -0.2) { const k = Math.min(1, (DODGE_R - d) * 4) * dt * 6; q.ox += (dx / Math.max(d, 0.01)) * k; q.oz += (dz / Math.max(d, 0.01)) * k; q.flinch = Math.max(q.flinch, 0.5); }
          else { q.ox *= 1 - dt * 0.4; q.oz *= 1 - dt * 0.4; }
          // watch the truck while it is close enough to see
          const want = d < SEE ? Math.atan2(-dx, -dz) : q.face;
          let dy = want - q.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          q.yaw += dy * Math.min(1, dt * 3);
        }
        q.cheer = Math.max(0, q.cheer - dt); q.flinch = Math.max(0, q.flinch - dt);
        const x = q.x + q.ox, z = q.z + q.oz;
        if (eye && Math.hypot(x - eye.x, z - eye.z) > DRAW_R) continue;
        const slot = j++;
        const ch = Math.min(1, q.cheer * 2), fl = Math.min(1, q.flinch * 2);
        const hop = ch * Math.abs(Math.sin(t * 9 + q.phase)) * 0.12;
        const duck = fl * 0.22;
        const y = hf.heightAt(x, z) - 0.02 + hop;
        const s = q.scale;
        if (scan) {
          // the scan: idle sway, bouncing and rocking when cheering, crouched and leaning back when flinching;
          // every other one mirrored so the crowd is not one pose repeated
          const lean = Math.sin(t * 1.3 + q.phase) * 0.03 + ch * Math.sin(t * 9 + q.phase) * 0.1 - fl * 0.22;
          _q.setFromEuler(_e.set(lean, q.yaw, 0));
          const k = s * H;
          _s.set(i % 2 ? -k : k, k * (1 - duck * 0.7), k); _p.set(x, y, z);
          _m.compose(_p, _q, _s); scan.setMatrixAt(slot, _m);
          continue;
        }
        // body + head: a little idle sway; ducking squashes the body
        _q.setFromEuler(_e.set(Math.sin(t * 1.3 + q.phase) * 0.03, q.yaw, 0));
        _s.set(s, s * (1 - duck), s); _p.set(x, y, z);
        _m.compose(_p, _q, _s); body.setMatrixAt(slot, _m); head.setMatrixAt(slot, _m);
        _s.set(s, s * (1 - duck * 1.4), s); _m.compose(_p, _q, _s); legs.setMatrixAt(slot, _m);
        // arms: hanging when idle, up when cheering (waving), forward over the head when flinching
        for (const [mesh, side] of [[armL, 1], [armR, -1]]) {
          const raise = ch * (2.6 + Math.sin(t * 10 + q.phase + side) * 0.35) + fl * 1.9;
          _q.setFromEuler(_e.set(-fl * 0.9, q.yaw, side * (0.12 + raise), 'YXZ'));
          _p.set(x + Math.cos(q.yaw) * 0.125 * side * s, y + 0.66 * s * (1 - duck), z - Math.sin(q.yaw) * 0.125 * side * s);
          _s.set(s, s, s);
          _m.compose(_p, _q, _s); mesh.setMatrixAt(slot, _m);
        }
      }
      for (const m of [...stand, scan]) { if (!m) continue; m.count = j; m.instanceMatrix.needsUpdate = true; }
    },
  };
  api.update(0, null, null);
  return api;
}
