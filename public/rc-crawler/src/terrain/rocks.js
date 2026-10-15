// Procedural rock prototypes (noise-displaced, plane-cut icospheres) rendered as InstancedMeshes,
// and rasterized into the physics heightfield so the crawler can climb exactly what it sees.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise3, Rng } from '../core/noise.js';
import { SURF } from './heightfield.js';

const KINDS = ['boulder', 'slab', 'block', 'pebble', 'cliff', 'flat'];

function makeRockGeometry(kind, seed, detail) {
  const rng = new Rng(seed);
  const nz = new Noise3(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position;
  // fracture planes: flat faces with rough, slightly undulating surfaces and crisp-ish edges
  const cuts = [];
  const nCuts = { block: 12, cliff: 9, pebble: 4, flat: 6, slab: 8, boulder: 8 }[kind];
  for (let i = 0; i < nCuts; i++) {
    const n = new THREE.Vector3(rng.gauss(), rng.gauss() * (kind === 'slab' || kind === 'flat' ? 1.4 : 0.7), rng.gauss()).normalize();
    cuts.push({ n, d: rng.float(kind === 'block' ? 0.55 : 0.6, 0.88), k: rng.float(0.85, 1.0) });
  }
  // strata layers (sedimentary cliffs and slabs): each layer recessed by a different amount
  const layerOff = Array.from({ length: 24 }, () => rng.float(0, 1));
  const freq = rng.float(1.1, 1.7), amp = kind === 'pebble' ? 0.12 : 0.17;
  const v = new THREE.Vector3(), d0 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d0.fromBufferAttribute(pos, i).normalize();
    v.copy(d0);
    let r = 1 + nz.fbm(v.x * freq + 3, v.y * freq + 7, v.z * freq + 11, 4) * amp * 2.2;
    v.multiplyScalar(r);
    for (const c of cuts) {
      const d = v.dot(c.n);
      const plane = c.d + nz.noise(v.x * 3.1 + c.d * 9, v.y * 3.1, v.z * 3.1) * 0.025; // rough fracture face
      if (d > plane) v.addScaledVector(c.n, (plane - d) * c.k);
    }
    // chipped edges + granular surface: ridged high-frequency displacement along the original direction
    const ch = 1 - Math.abs(nz.noise(d0.x * 7.3 + 5, d0.y * 7.3, d0.z * 7.3));
    const micro = nz.noise(d0.x * 17, d0.y * 17, d0.z * 17);
    v.addScaledVector(d0, (ch * ch * ch - 0.3) * 0.03 + micro * 0.008);
    if (kind === 'cliff' || kind === 'slab') {
      const layerH = kind === 'cliff' ? 0.2 : 0.14;
      const yy = v.y + nz.noise(v.x * 1.7, v.z * 1.7, 3) * 0.05;
      const li = Math.floor((yy + 2) / layerH);
      const frac = (yy + 2) / layerH - li;
      // recess per layer + a rounded lip at each layer edge
      const rec = 1 - layerOff[li % 24] * (kind === 'cliff' ? 0.1 : 0.06) - Math.pow(Math.abs(frac - 0.5) * 2, 6) * 0.03;
      v.x *= rec; v.z *= rec;
    }
    // flatten bottom (rocks sit in the ground)
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // per-kind proportions
  const s = { boulder: [1, 0.78, 1.05], slab: [1.25, 0.42, 1], block: [1, 0.85, 0.9], pebble: [1, 0.6, 0.85], cliff: [1, 1.7, 0.85], flat: [1.4, 0.3, 1.2] }[kind];
  g.scale(s[0], s[1], s[2]);
  g.computeVertexNormals();
  bakeCavity(g, s[1]);
  g.computeBoundingSphere();
  return g;
}

// Per-vertex ambient occlusion / edge wear from local curvature: crevices darken, exposed edges brighten,
// and the base (where the rock meets soil) gets darker and grimier.
function bakeCavity(g, sy) {
  const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index.array, n = pos.count;
  const sum = new Float32Array(n * 3), cnt = new Uint16Array(n), elen = new Float32Array(n);
  const add = (a, b) => {
    sum[a * 3] += pos.getX(b); sum[a * 3 + 1] += pos.getY(b); sum[a * 3 + 2] += pos.getZ(b); cnt[a]++;
    elen[a] += Math.hypot(pos.getX(b) - pos.getX(a), pos.getY(b) - pos.getY(a), pos.getZ(b) - pos.getZ(a));
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    add(a, b); add(a, c); add(b, a); add(b, c); add(c, a); add(c, b);
  }
  let cav = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!cnt[i]) continue;
    const ax = sum[i * 3] / cnt[i] - pos.getX(i), ay = sum[i * 3 + 1] / cnt[i] - pos.getY(i), az = sum[i * 3 + 2] / cnt[i] - pos.getZ(i);
    const e = elen[i] / cnt[i] || 1;
    cav[i] = (ax * nor.getX(i) + ay * nor.getY(i) + az * nor.getZ(i)) / e; // + concave, - convex
  }
  // blur once so it reads as soft occlusion, not noise
  const blur = new Float32Array(n), bc = new Uint16Array(n);
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = idx[t + k];
    blur[a] += cav[idx[t]] + cav[idx[t + 1]] + cav[idx[t + 2]]; bc[a] += 3;
  }
  for (let i = 0; i < n; i++) cav[i] = bc[i] ? blur[i] / bc[i] : 0;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = cav[i];
    let v = 1 - Math.max(0, c) * 3.2 + Math.max(0, -c) * 1.4;
    const y = pos.getY(i) / sy; // normalized height
    const base = 1 - Math.min(1, Math.max(0, (-0.12 - y) / 0.22));
    v *= 0.62 + 0.38 * base;
    v = Math.min(1.25, Math.max(0.35, v));
    // grime is slightly warmer/browner
    col[i * 3] = v * (base < 1 ? 1.0 : 1); col[i * 3 + 1] = v * (0.97 + 0.03 * base); col[i * 3 + 2] = v * (0.92 + 0.08 * base);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export class RockField {
  constructor(quality, seed = 7) {
    this.quality = quality;
    const det = { low: [2, 3], medium: [3, 5], high: [4, 7], ultra: [5, 9] }[quality] || [4, 7];
    this.protos = [];
    let s = seed * 100;
    for (const kind of KINDS) {
      const variants = kind === 'pebble' ? 3 : 4;
      for (let v = 0; v < variants; v++) {
        const small = kind === 'pebble';
        this.protos.push({ kind, geoLo: makeRockGeometry(kind, s, small ? Math.max(1, det[0] - 1) : det[0]), geoHi: small ? null : makeRockGeometry(kind, s, det[1]), list: [] });
        s++;
      }
    }
    this.byKind = {};
    this.protos.forEach((p, i) => { (this.byKind[p.kind] ||= []).push(i); });
    this.instances = [];
  }

  // add a rock: kind, position (x,y,z) base, size (uniform-ish), yaw, extra opts {tilt, sx, sy, sz, sink, physics, tint}
  add(rng, kind, x, y, z, size, o = {}) {
    const ids = this.byKind[kind];
    const pi = ids[Math.floor(rng.next() * ids.length)];
    const sx = size * (o.sx || rng.float(0.85, 1.2)), sy = size * (o.sy || rng.float(0.8, 1.15)), sz = size * (o.sz || rng.float(0.85, 1.2));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (o.tilt ?? 0.15) * rng.gauss(), o.yaw ?? rng.float(0, Math.PI * 2), (o.tilt ?? 0.15) * rng.gauss(), 'YXZ'));
    const sink = o.sink ?? 0.25;
    m.compose(new THREE.Vector3(x, y - sink * sy * 0.6 + sy * 0.25, z), q, new THREE.Vector3(sx, sy, sz));
    const big = Math.max(sx, sy, sz) > 0.9;
    const inst = { pi, m, big, physics: o.physics !== false, tint: o.tint ?? rng.float(0.8, 1.1), warm: o.warm ?? ((this.warmBase || 0) + rng.float(-0.05, 0.05)), radius: Math.max(sx, sz), x, z, top: y + sy };
    this.instances.push(inst);
    return inst;
  }

  rasterize(hf) {
    const tmp = new THREE.Vector3();
    for (const inst of this.instances) {
      if (!inst.physics) continue;
      const proto = this.protos[inst.pi];
      const g = proto.geoLo;
      const src = g.attributes.position.array;
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i += 3) {
        tmp.set(src[i], src[i + 1], src[i + 2]).applyMatrix4(inst.m);
        out[i] = tmp.x; out[i + 1] = tmp.y; out[i + 2] = tmp.z;
      }
      hf.rasterize(out, g.index.array, SURF.ROCK, 0.01);
    }
  }

  buildMeshes(material) {
    const group = new THREE.Group();
    const color = new THREE.Color();
    this.protos.forEach((p, pi) => {
      const list = this.instances.filter((i) => i.pi === pi);
      if (!list.length) return;
      // big rocks use high-detail geometry; small ones the low one
      const groups = p.geoHi ? [[list.filter((i) => i.big), p.geoHi], [list.filter((i) => !i.big), p.geoLo]] : [[list, p.geoLo]];
      for (const [arr, geo] of groups) {
        if (!arr.length) continue;
        const mesh = new THREE.InstancedMesh(geo, material, arr.length);
        arr.forEach((inst, k) => {
          mesh.setMatrixAt(k, inst.m);
          color.setRGB(inst.tint * (1 + inst.warm), inst.tint, inst.tint * (1 - inst.warm * 1.4));
          mesh.setColorAt(k, color);
        });
        mesh.castShadow = geo === p.geoHi || p.kind !== 'pebble';
        mesh.receiveShadow = true;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    });
    return group;
  }
}
