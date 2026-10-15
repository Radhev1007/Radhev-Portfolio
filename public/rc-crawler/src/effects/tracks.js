// Tyre-track ribbons laid behind each wheel, with a procedural tread print, fading over time.
import * as THREE from 'three';

function treadTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(255,255,255,1)';
  for (let y = 0; y < 128; y += 16) {
    g.save(); g.translate(16, y + 4); g.rotate(-0.35); g.fillRect(-12, -3, 24, 7); g.restore();
    g.save(); g.translate(48, y + 12); g.rotate(0.35); g.fillRect(-12, -3, 24, 7); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class TyreTracks {
  constructor(maxSeg = 2400) {
    this.max = maxSeg;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxSeg * 4 * 3);
    this.uv = new Float32Array(maxSeg * 4 * 2);
    this.col = new Float32Array(maxSeg * 4 * 4);
    // lit material needs normals: without them the lighting maths produces NaN, which renders as solid black
    this.nor = new Float32Array(maxSeg * 4 * 3);
    for (let i = 1; i < this.nor.length; i += 3) this.nor[i] = 1;
    const idx = new Uint32Array(maxSeg * 6);
    for (let i = 0; i < maxSeg; i++) { const v = i * 4; idx.set([v, v + 2, v + 1, v + 1, v + 2, v + 3], i * 6); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: treadTexture(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.6,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, color: 0xffffff,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.cursor = 0;
    this.last = [null, null, null, null];
    this.vAcc = [0, 0, 0, 0];
    this.age = new Float32Array(maxSeg);
  }

  reset() { this.last = [null, null, null, null]; }

  // p: contact point (world), side: axle direction (unit, world), n: ground normal, color, strength (0..1)
  add(i, p, side, n, color, strength) {
    const last = this.last[i];
    const cur = { x: p.x + n.x * 0.012, y: p.y + n.y * 0.012, z: p.z + n.z * 0.012, sx: side.x, sy: side.y, sz: side.z, nx: n.x, ny: n.y, nz: n.z };
    if (!last) { this.last[i] = cur; return; }
    const d = Math.hypot(cur.x - last.x, cur.z - last.z);
    if (d < 0.12) return;
    if (d > 1.0) { this.last[i] = cur; return; }
    const w = 0.085;
    const s = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    const P = this.pos, o = s * 12;
    P[o] = last.x + last.sx * w; P[o + 1] = last.y + last.sy * w; P[o + 2] = last.z + last.sz * w;
    P[o + 3] = last.x - last.sx * w; P[o + 4] = last.y - last.sy * w; P[o + 5] = last.z - last.sz * w;
    P[o + 6] = cur.x + cur.sx * w; P[o + 7] = cur.y + cur.sy * w; P[o + 8] = cur.z + cur.sz * w;
    P[o + 9] = cur.x - cur.sx * w; P[o + 10] = cur.y - cur.sy * w; P[o + 11] = cur.z - cur.sz * w;
    const N = this.nor;
    for (let k = 0; k < 4; k++) { const q = k < 2 ? last : cur; N[o + k * 3] = q.nx; N[o + k * 3 + 1] = q.ny; N[o + k * 3 + 2] = q.nz; }
    let v0 = this.vAcc[i];
    if (v0 > 60) v0 = 0;                     // wrap the tread pattern between segments, never inside one
    const v1 = v0 + d / 0.3; this.vAcc[i] = v1;
    this.uv.set([0, v0, 1, v0, 0, v1, 1, v1], s * 8);
    const C = this.col, co = s * 16;
    for (let k = 0; k < 4; k++) { C[co + k * 4] = color.r; C[co + k * 4 + 1] = color.g; C[co + k * 4 + 2] = color.b; C[co + k * 4 + 3] = strength; }
    this.age[s] = strength;
    this.last[i] = cur;
    this.dirty = true;
  }

  update(dt) {
    // slow fade
    this.fadeT = (this.fadeT || 0) + dt;
    if (this.fadeT > 0.5) {
      this.fadeT = 0;
      const C = this.col;
      for (let s = 0; s < this.max; s++) { if (C[s * 16 + 3] > 0) for (let k = 0; k < 4; k++) C[s * 16 + k * 4 + 3] *= 0.996; }
      this.dirty = true;
    }
    if (this.dirty) {
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.uv.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
      this.geo.attributes.normal.needsUpdate = true;
      this.dirty = false;
    }
  }
}
