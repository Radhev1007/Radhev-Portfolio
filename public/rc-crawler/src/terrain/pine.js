// Realistic conifers: painted needle-spray textures on alpha-tested branch cards arranged in whorls,
// tapered bark trunk with root flare and dead lower stubs, plus silhouette cards for distant forest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/noise.js';

export const TRUNK_RADIUS = 0.016; // base radius as a fraction of tree height (collision uses this too)

// ---------------------------------------------------------------- textures
let needleTex = null, farTex = null;

// One branch spray: a main twig (v: base -> tip) with side twigs, each densely covered in needles.
export function getNeedleTexture() {
  if (needleTex) return needleTex;
  const W = 256, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = new Rng(901);
  const Y = (v) => H - v * H; // v=0 at the bottom (branch base)
  const needleCol = (tip, shade) => {
    const h = 100 + rng.float(-12, 14) + tip * 6;
    const s = 18 + rng.float(0, 14) + tip * 8;
    const l = 9 + shade * 8 + tip * 10 + rng.float(-3, 3);
    return `hsl(${h},${s}%,${l}%)`;
  };
  const drawNeedles = (x0, y0, x1, y1, density, len, tipBias) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const n = Math.round(L * density);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const px = x0 + dx * t, py = y0 + dy * t;
      const tip = Math.max(0, (t - 0.55) / 0.45) * tipBias;
      for (const side of [-1, 1]) {
        // needles sweep forward along the twig at ~45°
        const ang = side * rng.float(0.5, 1.1);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = ux * ca - uy * sa, ny = ux * sa + uy * ca;
        const nl = len * rng.float(0.7, 1.15) * (1 - t * 0.35);
        g.strokeStyle = needleCol(tip, rng.next());
        g.lineWidth = rng.float(1.0, 1.9);
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + nx * nl * 0.5 + ux * 2, py + ny * nl * 0.5 + uy * 2, px + nx * nl, py + ny * nl);
        g.stroke();
      }
    }
  };
  g.lineCap = 'round';
  // darker under-layer of needles for depth
  g.globalAlpha = 1;
  const twigs = [];
  // main twig with gentle curve
  const main = [];
  for (let i = 0; i <= 12; i++) { const v = i / 12; main.push([W / 2 + Math.sin(v * 2.2) * 8, Y(0.02 + v * 0.96)]); }
  // side twigs (alternate), shorter toward the tip -> spray tapers like a real fir/pine branch
  for (let i = 1; i < 11; i++) {
    const v = i / 12, [bx, by] = main[i];
    for (const side of [-1, 1]) {
      if (rng.next() < 0.15) continue;
      const len = (1 - v * 0.75) * W * 0.42 * rng.float(0.75, 1.05);
      const ang = side * rng.float(0.65, 0.95);
      const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len * 0.75;
      twigs.push([bx, by, ex, ey, v]);
    }
  }
  // twig wood
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 3;
  g.beginPath(); main.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.lineWidth = 1.6;
  for (const [x0, y0, x1, y1] of twigs) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  // needles: dense, short, sweeping toward the tips
  for (const [x0, y0, x1, y1, v] of twigs) drawNeedles(x0, y0, x1, y1, 0.85, 20 - v * 6, 1);
  for (let i = 0; i < main.length - 1; i++) drawNeedles(main[i][0], main[i][1], main[i + 1][0], main[i + 1][1], 0.9, 24, i > 8 ? 1 : 0.3);
  // pale new-growth tufts at twig tips
  for (const [, , x1, y1] of twigs) drawNeedles(x1, y1, x1 + (x1 - W / 2) * 0.06, y1 - 8, 2, 12, 2);

  needleTex = new THREE.CanvasTexture(c);
  needleTex.colorSpace = THREE.SRGBColorSpace;
  needleTex.anisotropy = 8;
  needleTex.generateMipmaps = true;
  needleTex.minFilter = THREE.LinearMipmapLinearFilter;
  return needleTex;
}

// Whole-tree silhouette for distant forest cards
function getFarTexture() {
  if (farTex) return farTex;
  const W = 256, H = 512, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = new Rng(77);
  g.fillStyle = '#2b2118'; g.fillRect(W / 2 - 2, H * 0.55, 4, H * 0.45);
  for (let i = 0; i < 900; i++) {
    const v = rng.next() * 0.88 + 0.08;            // height up the tree
    const half = (1 - v) * W * 0.42 + 3;
    const x = W / 2 + rng.float(-1, 1) * half * Math.sqrt(rng.next());
    const y = H - v * H * 0.98 - H * 0.08;
    const lit = x > W / 2 ? 1 : 0.6;
    g.fillStyle = `hsl(${100 + rng.float(-8, 8)},${26 + rng.float(0, 10)}%,${(9 + rng.float(0, 7)) * lit}%)`;
    g.beginPath();
    const w = rng.float(10, 26) * (1 - v * 0.5), h = w * 0.5;
    g.moveTo(x - w, y + h * 0.4); g.lineTo(x, y - h); g.lineTo(x + w, y + h * 0.4); g.closePath(); g.fill();
  }
  farTex = new THREE.CanvasTexture(c);
  farTex.colorSpace = THREE.SRGBColorSpace;
  return farTex;
}

// ---------------------------------------------------------------- geometry
// A curved ribbon card along a branch; returns arrays for later merging.
function addRibbon(out, origin, dir, side, upv, L, width, segs, droop, twist, shade0, shade1) {
  const base = out.pos.length / 3;
  const tw = new THREE.Vector3().copy(side).applyAxisAngle(dir, twist);
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const c = origin.clone().addScaledVector(dir, t * L).addScaledVector(upv, -droop * t * t * L);
    const w = width * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.25 + 0.15) * Math.PI * 0.5 + 0.2));
    for (const k of [-1, 1]) {
      const p = c.clone().addScaledVector(tw, k * w * 0.5);
      out.pos.push(p.x, p.y, p.z);
      out.uv.push(k < 0 ? 0 : 1, t);
      // foliage normals: outward from the trunk + up, so the crown shades like a volume
      const ox = p.x, oz = p.z, ol = Math.hypot(ox, oz) || 1;
      const n = new THREE.Vector3(ox / ol * 0.75, 0.55 + t * 0.15, oz / ol * 0.75).normalize();
      out.nor.push(n.x, n.y, n.z);
      const sh = shade0 + (shade1 - shade0) * t;
      out.col.push(sh, sh, sh);
    }
  }
  for (let s = 0; s < segs; s++) {
    const a = base + s * 2;
    out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

export function pineGeometries(seed, detail) {
  const rng = new Rng(seed);
  // ---- trunk (height 1), slender with root flare
  const R0 = TRUNK_RADIUS;
  const radial = detail > 1 ? 10 : 7;
  const trunk = new THREE.CylinderGeometry(0.0025, R0, 1, radial, 10, true);
  trunk.translate(0, 0.5, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
    const a = Math.atan2(z, x);
    const flare = 1 + Math.pow(Math.max(0, 0.05 - y) / 0.05, 2) * 0.9 * (0.75 + 0.25 * Math.sin(a * 5 + seed));
    const lean = Math.sin(y * 3 + seed) * 0.004;
    tp.setXYZ(i, x * flare + lean, y, z * flare);
  }
  const tuv = trunk.attributes.uv;
  for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 2, tuv.getY(i) * 9);
  trunk.computeVertexNormals();

  const crownBase = rng.float(0.3, 0.42);
  // dead stubs below the living crown
  const stubs = [];
  const nStubs = detail > 1 ? 14 : 6;
  for (let i = 0; i < nStubs; i++) {
    const y = rng.float(0.08, crownBase + 0.04);
    const len = rng.float(0.008, 0.03) * (0.5 + y);
    const s = new THREE.CylinderGeometry(0.0003, 0.0013, len, 4, 1, true);
    s.translate(0, len / 2, 0);
    s.rotateZ(-Math.PI / 2 - rng.float(0.1, 0.6));
    s.rotateY(rng.float(0, Math.PI * 2));
    s.translate(0, y, 0);
    stubs.push(s);
  }
  const trunkAll = mergeGeometries([trunk, ...stubs]);

  // ---- living crown: whorls of drooping branch sprays
  const out = { pos: [], nor: [], uv: [], col: [], idx: [] };
  const nW = detail > 1 ? 20 : 12;
  const perW = detail > 1 ? 6 : 4;
  const segs = detail > 1 ? 3 : 2;
  const up = new THREE.Vector3(0, 1, 0);
  const Lmax = rng.float(0.17, 0.22);
  for (let w = 0; w < nW; w++) {
    const f = w / (nW - 1);                              // 0 bottom of crown .. 1 top
    const y = crownBase + f * (0.985 - crownBase) + rng.float(-0.008, 0.008);
    const trunkR = R0 * (1 - y * 0.85);
    const Lw = (Lmax * Math.pow(1 - f, 0.85) + 0.025) * (f < 0.08 ? 0.75 : 1);
    const a0 = rng.float(0, Math.PI * 2);
    const n = f > 0.85 ? Math.max(3, perW - 2) : perW;
    for (let b = 0; b < n; b++) {
      if (f < 0.25 && rng.next() < 0.25) continue;       // gaps low in the crown
      const a = a0 + (b / n) * Math.PI * 2 + rng.float(-0.35, 0.35);
      const L = Lw * rng.float(0.72, 1.12);
      const pitch = THREE.MathUtils.lerp(-0.28, 0.5, f) + rng.float(-0.1, 0.1);
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(pitch), Math.sin(pitch), Math.sin(a) * Math.cos(pitch)).normalize();
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      const origin = new THREE.Vector3(Math.cos(a) * trunkR, y, Math.sin(a) * trunkR);
      const droop = THREE.MathUtils.lerp(0.42, 0.12, f) * rng.float(0.8, 1.2);
      const ao = 0.42 + 0.3 * f;                          // inner/lower foliage darker
      addRibbon(out, origin, dir, side, up, L, L * 0.62, segs, droop, rng.float(-0.25, 0.25), ao * 0.7, 1.0);
      if (detail > 1 || b % 2 === 0) addRibbon(out, origin, dir, side, up, L * 0.92, L * 0.5, segs, droop, Math.PI / 2 + rng.float(-0.3, 0.3), ao * 0.6, 0.9);
    }
    // inner filler sprays so the crown isn't see-through near the trunk
    if (detail > 1 && f < 0.9) {
      const a = a0 + Math.PI / perW;
      const L = Lw * 0.5;
      const dir = new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a)).normalize();
      addRibbon(out, new THREE.Vector3(0, y + 0.01, 0), dir, new THREE.Vector3().crossVectors(up, dir).normalize(), up, L, L * 0.8, 1, 0.1, 0, 0.35, 0.55);
    }
  }
  // leader at the very top
  for (let k = 0; k < 2; k++) {
    const side = new THREE.Vector3(Math.cos(k * Math.PI / 2), 0, Math.sin(k * Math.PI / 2));
    addRibbon(out, new THREE.Vector3(0, 0.95, 0), up.clone(), side, new THREE.Vector3(1, 0, 0), 0.075, 0.035, 1, 0, 0, 0.8, 1.05);
  }
  const fol = new THREE.BufferGeometry();
  fol.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  fol.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  fol.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  fol.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  fol.setIndex(out.idx);
  fol.computeBoundingSphere();
  return { trunk: trunkAll, foliage: fol };
}

export function farTreeGeometry() {
  const parts = [];
  for (let k = 0; k < 2; k++) {
    const q = new THREE.PlaneGeometry(0.42, 1, 1, 1);
    q.translate(0, 0.5, 0);
    q.rotateY(k * Math.PI / 2);
    const n = q.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    parts.push(q);
  }
  return mergeGeometries(parts);
}

// Foliage material: alpha-tested needle cards, wind sway, two-sided lighting without normal flipping.
export function createNeedleMaterial(quality, windUniforms) {
  const m = new THREE.MeshStandardMaterial({
    map: getNeedleTexture(), vertexColors: true, alphaTest: 0.38, side: THREE.DoubleSide,
    roughness: 0.82, metalness: 0, envMapIntensity: 0.6,
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
          float ph = ip.x * 0.37 + ip.z * 0.23;
          float k = max(0., position.y - 0.3); k *= k;
          float r = length(position.xz);
          // whole-crown sway + per-branch flutter at the tips
          float sway = sin(uTime * 0.8 + ph) * 0.6 + sin(uTime * 2.1 + ph * 1.7) * 0.18;
          float flutter = sin(uTime * 4.3 + position.x * 40. + position.z * 37. + ph) * r * 0.02;
          transformed.x += (sway * k * 0.02 + flutter) * uWind;
          transformed.z += (sin(uTime * 0.65 + ph * 1.3) * k * 0.014) * uWind;
          transformed.y += flutter * 0.5 * uWind;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      // a little light transmission through sunlit needles
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.04;');
  };
  m.customProgramCacheKey = () => 'needles-v1';
  return m;
}

export function createFarTreeMaterial() {
  return new THREE.MeshStandardMaterial({ map: getFarTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 });
}
