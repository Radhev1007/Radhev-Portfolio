// Realistic shrubs: painted leafy-twig textures on alpha-tested cards radiating from a woody base.
// 'green' = broadleaf understory shrub (forest/creek/mud), 'dry' = grey-green sagebrush (desert/canyon).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/noise.js';

const texCache = {};

// A twig spray: main stem bottom->top with side twigs, covered in leaves.
function getLeafTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const W = 256, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = new Rng(kind === 'dry' ? 515 : 313);
  const dry = kind === 'dry';
  g.lineCap = 'round';
  const Y = (v) => H - v * H;
  const stem = [];
  for (let i = 0; i <= 10; i++) { const v = i / 10; stem.push([W / 2 + Math.sin(v * 2.5 + 1) * 10, Y(0.02 + v * 0.95)]); }
  const twigs = [];
  for (let i = 1; i < 10; i++) {
    const [bx, by] = stem[i], v = i / 10;
    for (const side of [-1, 1]) {
      if (rng.next() < (dry ? 0.08 : 0.08)) continue;
      const len = (0.52 - Math.abs(v - 0.45) * 0.5) * W * rng.float(0.7, 1.0);
      const ang = side * rng.float(0.5, 1.0);
      twigs.push([bx, by, bx + Math.sin(ang) * len, by - Math.cos(ang) * len * 0.8, v]);
    }
  }
  // woody stems
  g.strokeStyle = dry ? '#6e5c4a' : '#3e2f22';
  g.lineWidth = dry ? 3 : 3.5;
  g.beginPath(); stem.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.lineWidth = dry ? 1.6 : 2;
  for (const [x0, y0, x1, y1] of twigs) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }

  const leaf = (x, y, ang, len, wid, shade, back) => {
    let h, s, l;
    if (dry) { h = 88 + rng.float(-12, 10); s = 9 + rng.float(0, 9); l = 46 + shade * 16 + rng.float(-5, 5); }
    else {
      h = 92 + rng.float(-16, 14); s = 30 + rng.float(0, 22); l = 12 + shade * 15 + rng.float(-3, 4);
      if (rng.next() < 0.05) { h = 55 + rng.float(0, 10); s = 45; l = 26; } // the odd yellowing leaf
    }
    g.save();
    g.translate(x, y); g.rotate(ang);
    g.fillStyle = `hsl(${h},${s}%,${l * (back ? 0.75 : 1)}%)`;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    g.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    g.fill();
    if (!dry && len > 9) { // midrib
      g.strokeStyle = `hsla(${h},${s}%,${l + 10}%,0.6)`; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(0, -1); g.lineTo(0, -len * 0.85); g.stroke();
    }
    g.restore();
  };
  // leaves along twigs: back layer darker, then front
  for (const back of [true, false]) {
    for (const [x0, y0, x1, y1] of twigs) {
      const n = dry ? 30 : 18;
      const base = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const t = (i + rng.next()) / n;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const side = i % 2 ? 1 : -1;
        const ang = base + side * rng.float(0.5, 1.2);
        if (dry) leaf(x, y, ang, rng.float(5, 10), rng.float(1.5, 2.6), rng.next() * (0.5 + t * 0.5), back);
        else leaf(x, y, ang, rng.float(13, 24) * (1 - t * 0.25), rng.float(5, 8.5), rng.next() * (0.4 + t * 0.6), back);
      }
      // tip cluster
      for (let k = 0; k < (dry ? 8 : 3); k++) {
        if (dry) leaf(x1, y1, rng.float(0, 6.28), rng.float(5, 9), 2, 0.9, back);
        else leaf(x1, y1, Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2 + rng.float(-0.6, 0.6), rng.float(12, 18), 6, 0.9, back);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache[kind] = t;
  return t;
}

function addCard(out, origin, dir, side, L, width, segs, bend, center, ao0, ao1) {
  const base = out.pos.length / 3;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const p0 = origin.clone().addScaledVector(dir, t * L);
    p0.y -= bend * t * t * L;
    for (const k of [-1, 1]) {
      const p = p0.clone().addScaledVector(side, k * width * 0.5 * (0.6 + 0.4 * t));
      out.pos.push(p.x, p.y, p.z);
      out.uv.push(k < 0 ? 0 : 1, t);
      // dome normals: from the shrub's centre outwards, biased up
      const n = p.clone().sub(center); n.y = Math.max(n.y, 0) * 0.8 + 0.35; n.normalize();
      out.nor.push(n.x, n.y, n.z);
      const a = ao0 + (ao1 - ao0) * t;
      out.col.push(a, a, a);
    }
  }
  for (let s = 0; s < segs; s++) { const a = base + s * 2; out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
}

// Unit shrub (~1.6 wide, ~1.1 tall before per-instance scale)
export function shrubGeometry(seed, kind, detail) {
  const rng = new Rng(seed);
  const dry = kind === 'dry';
  const out = { pos: [], nor: [], uv: [], col: [], idx: [] };
  const center = new THREE.Vector3(0, dry ? 0.35 : 0.3, 0);
  const n = (detail > 1 ? 46 : 24) * (dry ? 1.0 : 1);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 * 2.4 + rng.float(-0.3, 0.3); // spiral spread
    const el = dry ? rng.float(0.4, 1.4) : rng.float(0.3, 1.45);
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const L = (dry ? rng.float(0.5, 0.85) : rng.float(0.6, 1.0)) * (0.8 + 0.2 * Math.sin(el));
    const r0 = rng.float(0, 0.12);
    const origin = new THREE.Vector3(Math.cos(az) * r0, rng.float(0.0, 0.08), Math.sin(az) * r0);
    let side = new THREE.Vector3().crossVectors(up, dir);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(dir, rng.float(-0.4, 0.4));
    const ao0 = dry ? 0.65 : 0.45, ao1 = 1.1;
    const bend = dry ? 0.05 : 0.22;
    addCard(out, origin, dir, side, L, L * (dry ? 0.85 : 1.0), detail > 1 ? 2 : 1, bend, center, ao0, ao1);
    if (detail > 1 || i % 2 === 0) {
      const side2 = side.clone().applyAxisAngle(dir, Math.PI / 2);
      addCard(out, origin, dir, side2, L * 0.9, L * 0.65, 1, bend, center, ao0 * 0.9, 0.9);
    }
  }
  if (!dry) {
    for (let i = 0; i < (detail > 1 ? 10 : 5); i++) {
      const az = rng.float(0, Math.PI * 2);
      const dir = new THREE.Vector3(Math.cos(az), rng.float(0.2, 0.6), Math.sin(az)).normalize();
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      addCard(out, new THREE.Vector3(0, rng.float(0.15, 0.4), 0), dir, side, 0.45, 0.5, 1, 0.05, center, 0.4, 0.7);
    }
  }
  const fol = new THREE.BufferGeometry();
  fol.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  fol.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  fol.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  fol.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  fol.setIndex(out.idx);
  fol.computeBoundingSphere();
  // woody base stems (visible through sparse sagebrush)
  const stems = [];
  const ns = dry ? 7 : 4;
  for (let i = 0; i < ns; i++) {
    const len = rng.float(0.25, 0.5);
    const s = new THREE.CylinderGeometry(0.006, 0.016, len, 4, 1, true);
    s.translate(0, len / 2, 0);
    s.rotateZ(rng.float(0.2, 0.7) * (i % 2 ? 1 : -1));
    s.rotateY(rng.float(0, Math.PI * 2));
    stems.push(s);
  }
  return { foliage: fol, stems: mergeGeometries(stems) };
}

export function createShrubMaterial(kind, quality, windUniforms) {
  const m = new THREE.MeshStandardMaterial({
    map: getLeafTexture(kind), vertexColors: true, alphaTest: kind === 'dry' ? 0.4 : 0.42, side: THREE.DoubleSide,
    roughness: kind === 'dry' ? 0.9 : 0.75, metalness: 0, envMapIntensity: 0.6,
  });
  m.alphaToCoverage = quality !== 'low';
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
          float ph = ip.x * 0.71 + ip.z * 0.53;
          float k = position.y * position.y;
          float flutter = sin(uTime * 5.1 + position.x * 23. + position.z * 19. + ph) * 0.012 * length(position);
          transformed.x += (sin(uTime * 1.6 + ph) * 0.03 * k + flutter) * uWind;
          transformed.z += (sin(uTime * 1.3 + ph * 1.4) * 0.02 * k - flutter * 0.6) * uWind;
          transformed.y += flutter * 0.5 * uWind;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.05;');
  };
  m.customProgramCacheKey = () => 'shrub-' + kind;
  return m;
}
