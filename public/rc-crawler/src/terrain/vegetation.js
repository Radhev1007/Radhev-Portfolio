// Procedural vegetation: pines, bushes, grass tufts, desert plants, logs, roots, branches.
// Everything is instanced; foliage + grass sway with a shared wind uniform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise3, Rng } from '../core/noise.js';
import { makeBarkTexture } from './textures.js';
import { shrubGeometry, createShrubMaterial } from './shrub.js';
import { grassTuftGeometry, createGrassMaterial } from './grass.js';
import { pineGeometries, farTreeGeometry, createNeedleMaterial, createFarTreeMaterial } from './pine.js';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
const _col = new THREE.Color();

function colorize(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function windMaterial(opts, strength = 1, kind = 'tree') {
  const m = new THREE.MeshStandardMaterial(opts);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, windUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        {
          vec3 ip = vec3(0.);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float ph = ip.x * 0.37 + ip.z * 0.23;
          ${kind === 'grass'
            ? 'float k = position.y * position.y * 2.2; transformed.x += (sin(uTime * 2.1 + ph) * 0.6 + sin(uTime * 3.7 + ph * 1.7) * 0.25 + 0.35) * k * 0.12 * uWind; transformed.z += sin(uTime * 1.7 + ph * 1.3) * k * 0.06 * uWind;'
            : 'float k = max(0., position.y - 0.25); k *= k; transformed.x += (sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 2.3 + ph) * 0.15) * k * 0.025 * uWind * ' + strength.toFixed(3) + '; transformed.z += sin(uTime * 0.7 + ph * 1.3) * k * 0.015 * uWind * ' + strength.toFixed(3) + ';'}
        }`);
  };
  m.customProgramCacheKey = () => 'wind-' + kind + strength;
  return m;
}

// ---------- geometry builders (unit-ish size, scaled per instance)

function yuccaGeometry(seed) {
  const rng = new Rng(seed);
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const blade = new THREE.ConeGeometry(0.035, rng.float(0.6, 1.0), 3, 1);
    blade.translate(0, 0.4, 0);
    blade.rotateZ(rng.float(0.15, 1.2));
    blade.rotateY(rng.float(0, Math.PI * 2));
    parts.push(blade);
  }
  const g = mergeGeometries(parts);
  colorize(g, (c, x, y) => c.setHSL(0.2, 0.3, 0.12 + y * 0.12));
  return g;
}

function branchGeometry(seed) {
  const rng = new Rng(seed);
  const pts = [];
  let x = 0, y = 0.04, z = 0;
  for (let i = 0; i < 6; i++) { pts.push(new THREE.Vector3(x, y, z)); x += rng.float(0.4, 0.7); z += rng.float(-0.15, 0.15); y = 0.03 + rng.float(0, 0.03); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.035, 5, false);
  return g;
}

// ---------- Vegetation system

export class Vegetation {
  constructor(quality) {
    this.quality = quality;
    this.q = { low: 0.3, medium: 0.6, high: 1, ultra: 1.5 }[quality] ?? 1;
    this.detail = quality === 'low' ? 1 : 2;
    this.bark = makeBarkTexture();
    this.trees = []; this.bushes = []; this.grass = []; this.dryGrass = []; this.yucca = []; this.branches = []; this.farTrees = [];
    this.logs = []; this.roots = [];
  }

  addTree(x, y, z, height, yaw = 0) { this.trees.push({ x, y, z, s: height, yaw }); }
  addFarTree(x, y, z, height) { this.farTrees.push({ x, y, z, s: height }); }
  addBush(x, y, z, s, dry = false) { this.bushes.push({ x, y, z, s, dry, yaw: (x * 7.31 + z * 3.17) % 6.28 }); }
  addGrass(x, y, z, s, dry = false) { (dry ? this.dryGrass : this.grass).push({ x, y, z, s, yaw: (x * 13.1 + z * 7.7) % 6.28 }); }
  addYucca(x, y, z, s) { this.yucca.push({ x, y, z, s, yaw: x * 3.3 }); }
  addBranch(x, y, z, s, yaw) { this.branches.push({ x, y, z, s, yaw }); }

  // log geometry is built per-instance (unique lengths) & returned for rasterization
  makeLog(x, y, z, length, radius, yaw, pitch = 0) {
    const g = new THREE.CylinderGeometry(radius * 0.92, radius, length, 12, 4, false);
    g.rotateZ(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i); p.setY(i, p.getY(i) + Math.sin(px * 1.3) * radius * 0.15); }
    g.computeVertexNormals();
    // uv tweak for bark repeat
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * length * 0.8);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + radius * 0.75, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, pitch, 'YXZ')), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    this.logs.push(g);
    return g;
  }

  makeRoot(points, radius) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 4), radius, 6, false);
    this.roots.push(g);
    return g;
  }

  _inst(geo, mat, list, castShadow, mapFn, chunk = 0, colorFn = null) {
    const group = new THREE.Group();
    if (!list.length) return group;
    // chunk spatially so frustum culling works on big lists
    const buckets = new Map();
    for (const it of list) {
      const key = chunk ? Math.floor(it.x / chunk) + ',' + Math.floor(it.z / chunk) : '0';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(it);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const arr of buckets.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((it, i) => {
        q.setFromAxisAngle(up, it.yaw || 0);
        if (mapFn) mapFn(it, s); else s.setScalar(it.s);
        m.compose(p.set(it.x, it.y, it.z), q, s);
        mesh.setMatrixAt(i, m);
        if (colorFn) mesh.setColorAt(i, colorFn(it, _col));
      });
      mesh.castShadow = castShadow; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }

  build() {
    const root = new THREE.Group();
    const d = this.detail;
    // pines: 3 variants
    const trunkMat = new THREE.MeshStandardMaterial({ map: this.bark, color: 0x8a8278, roughness: 0.96 });
    const folMat = createNeedleMaterial(this.quality, windUniforms);
    const variants = [0, 1, 2, 3].map((v) => pineGeometries(40 + v * 7, d));
    const tv = variants.map(() => []);
    this.trees.forEach((t, i) => tv[i % variants.length].push(t));
    // per-tree tint: some bluer spruce-like, some warmer/yellower
    const tint = (it, c) => {
      const h = Math.sin(it.x * 12.9898 + it.z * 78.233) * 43758.5453, r = h - Math.floor(h);
      return c.setRGB(0.85 + r * 0.25, 0.9 + r * 0.15, 0.82 + (1 - r) * 0.22);
    };
    variants.forEach((g, v) => {
      const sc = (it, s) => s.set(it.s * (0.85 + (v % 2) * 0.12), it.s, it.s * (0.85 + (v % 2) * 0.12));
      root.add(this._inst(g.trunk, trunkMat, tv[v], true, sc, 40));
      root.add(this._inst(g.foliage, folMat, tv[v], true, sc, 40, tint));
    });
    // far trees: silhouette cards
    if (this.farTrees.length) {
      root.add(this._inst(farTreeGeometry(), createFarTreeMaterial(), this.farTrees, false, null, 120));
    }
    // shrubs: leafy cards (green) or sagebrush (dry), 3 shape variants each, per-instance tint
    const shrubTint = (it, c) => {
      const h = Math.sin(it.x * 91.7 + it.z * 37.3) * 43758.5453, r = h - Math.floor(h);
      return it.dry ? c.setRGB(0.9 + r * 0.2, 0.92 + r * 0.14, 0.88 + r * 0.12) : c.setRGB(0.82 + r * 0.3, 0.88 + r * 0.18, 0.8 + (1 - r) * 0.2);
    };
    const stemMat = new THREE.MeshStandardMaterial({ map: this.bark, color: 0x6a5a4a, roughness: 0.95 });
    for (const kind of ['green', 'dry']) {
      const list = this.bushes.filter((b) => b.dry === (kind === 'dry'));
      if (!list.length) continue;
      const mat = createShrubMaterial(kind, this.quality, windUniforms);
      const buckets = [[], [], []];
      list.forEach((b, i) => buckets[i % 3].push(b));
      buckets.forEach((arr, v) => {
        const g = shrubGeometry(100 + v * 13 + (kind === 'dry' ? 50 : 0), kind, d);
        root.add(this._inst(g.foliage, mat, arr, true, null, 30, shrubTint));
        if (kind === 'dry' || d > 1) root.add(this._inst(g.stems, stemMat, arr, false, null, 30));
      });
    }
    // grass: crossed blade cards, 3 tuft variants per kind, colour drifting in soft patches
    const patch = (it, c) => {
      const p = Math.sin(it.x * 0.17 + Math.sin(it.z * 0.11) * 2) * 0.5 + Math.sin(it.z * 0.23 - it.x * 0.07) * 0.5; // -1..1, smooth
      const j = Math.sin(it.x * 12.9898 + it.z * 78.233) * 43758.5453, r = j - Math.floor(j);
      return c.setRGB(0.9 + p * 0.12 + r * 0.08, 0.92 + p * 0.05 + r * 0.06, 0.85 - p * 0.1 + r * 0.05);
    };
    for (const kind of ['green', 'dry']) {
      const list = kind === 'dry' ? this.dryGrass : this.grass;
      if (!list.length) continue;
      const mat = createGrassMaterial(kind, this.quality, windUniforms);
      const buckets = [[], [], []];
      list.forEach((t, i) => buckets[i % 3].push(t));
      buckets.forEach((arr, v) => root.add(this._inst(grassTuftGeometry(300 + v * 11 + (kind === 'dry' ? 40 : 0), kind, d), mat, arr, this.quality === 'ultra', null, 16, patch)));
    }
    // yucca / desert plants
    const yMat = windMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }, 1.5, 'bush');
    root.add(this._inst(yuccaGeometry(12), yMat, this.yucca, true, null, 30));
    // branches
    const brMat = new THREE.MeshStandardMaterial({ map: this.bark, color: 0x9a8a7a, roughness: 0.95 });
    root.add(this._inst(branchGeometry(21), brMat, this.branches, true, null, 30));
    // logs + roots (unique geometry, merged)
    const logMat = new THREE.MeshStandardMaterial({ map: this.bark, color: 0xa89884, roughness: 0.92 });
    if (this.logs.length) { const m = new THREE.Mesh(mergeGeometries(this.logs), logMat); m.castShadow = m.receiveShadow = true; root.add(m); }
    if (this.roots.length) {
      const rg = mergeGeometries(this.roots);
      const m = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: this.bark, color: 0x8a7258, roughness: 0.9 })); m.castShadow = m.receiveShadow = true; root.add(m);
    }
    return root;
  }
}
