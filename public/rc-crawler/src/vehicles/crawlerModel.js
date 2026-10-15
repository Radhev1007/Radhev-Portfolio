// =============================================================================
//  crawlerModel.js
//  Procedural 1/30 "SCX30 Jeep Wrangler JLU Rubicon" style RC rock crawler.
//
//  Everything is built from procedural geometry (no external assets).  Static
//  sprung parts are merged per material to keep draw calls low; the unsprung
//  and articulated parts (axles, wheels, links, shocks, steering, driveshafts)
//  are separate objects animated in update().
//
//  Vehicle local frame:  +Z forward, +Y up, +X = LEFT side of the vehicle.
//  Origin = chassis reference point.  1 unit ~ 10 cm (model scale-ish).
//  Wheel order everywhere: [FL, FR, RL, RR].
// =============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const CRAWLER_DIMS = {
  wheelBase: 1.12,
  track: 0.68,
  wheelRadius: 0.2,
  wheelWidth: 0.19,
  hubRestY: -0.10,
  length: 1.75,
  width: 0.86,
  height: 0.70,
};

// -----------------------------------------------------------------------------
//  Constants
// -----------------------------------------------------------------------------
const PI = Math.PI;
const HALF_TRACK = CRAWLER_DIMS.track / 2;          // 0.34
const AXLE_Z = [CRAWLER_DIMS.wheelBase / 2, -CRAWLER_DIMS.wheelBase / 2]; // front, rear
const HUB_X = [HALF_TRACK, -HALF_TRACK, HALF_TRACK, -HALF_TRACK];
const REST_Y = CRAWLER_DIMS.hubRestY;
const REST_HUB_Y = [REST_Y, REST_Y, REST_Y, REST_Y];
const ZERO4 = [0, 0, 0, 0];
const DIFF_X = -0.035;                               // diff pumpkin offset (axle local X)

// Quality presets ------------------------------------------------------------
const QUALITY = {
  low: {
    detail: 0, curve: 6, bevelSeg: 1, rbSeg: 1, cylSeg: 10, tireSeg: 32,
    lugPitches: 24, lugBevel: 0, spokes: 5, beadBolts: 0,
    springTurns: 6, springSeg: 8, interior: false, clearcoat: false, texSize: 0,
  },
  medium: {
    detail: 1, curve: 10, bevelSeg: 2, rbSeg: 2, cylSeg: 14, tireSeg: 48,
    lugPitches: 30, lugBevel: 0.0014, spokes: 6, beadBolts: 12,
    springTurns: 7, springSeg: 10, interior: true, clearcoat: false, texSize: 128,
  },
  high: {
    detail: 2, curve: 14, bevelSeg: 3, rbSeg: 2, cylSeg: 18, tireSeg: 64,
    lugPitches: 36, lugBevel: 0.0016, spokes: 6, beadBolts: 16,
    springTurns: 8, springSeg: 14, interior: true, clearcoat: true, texSize: 256,
  },
  ultra: {
    detail: 3, curve: 20, bevelSeg: 4, rbSeg: 3, cylSeg: 24, tireSeg: 80,
    lugPitches: 40, lugBevel: 0.0018, spokes: 6, beadBolts: 20,
    springTurns: 9, springSeg: 18, interior: true, clearcoat: true, texSize: 256,
  },
};

// Materials whose meshes are too small to be worth a shadow-map pass.
const NO_SHADOW = new Set(['bolt', 'trim', 'headLens', 'barLens', 'tailLens', 'brakeLens', 'amber', 'headDome']);

// Active quality settings while building (createCrawler is synchronous).
let QS = QUALITY.high;

// -----------------------------------------------------------------------------
//  Geometry helpers
// -----------------------------------------------------------------------------
const _e = new THREE.Euler();
const _qt = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Build a TRS matrix. */
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ') {
  _e.set(rx, ry, rz, order);
  _qt.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _qt, _s.set(sx, sy, sz));
}

/** Normalise a geometry so it can be merged: non-indexed, position/normal/uv only, no groups. */
function prep(g) {
  let geo = g;
  if (geo.index) {
    geo = g.toNonIndexed();
    g.dispose();
  }
  for (const k of Object.keys(geo.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
  }
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  }
  geo.clearGroups();
  geo.morphAttributes = {};
  return geo;
}

/** Reverse triangle winding of a non-indexed geometry (after a mirroring transform). */
function flipWinding(geo) {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name];
    const n = a.itemSize;
    const arr = a.array;
    for (let t = 0; t < a.count; t += 3) {
      const i1 = (t + 1) * n, i2 = (t + 2) * n;
      for (let c = 0; c < n; c++) {
        const tmp = arr[i1 + c];
        arr[i1 + c] = arr[i2 + c];
        arr[i2 + c] = tmp;
      }
    }
    a.needsUpdate = true;
  }
  return geo;
}

/** Apply a matrix to a prepared geometry, fixing winding for mirror transforms. */
function xform(geo, m) {
  geo.applyMatrix4(m);
  if (m.determinant() < 0) flipWinding(geo);
  return geo;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function rbox(w, h, d, r = 0.006, seg = QS.rbSeg) {
  const rr = Math.max(1e-4, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}
const cyl = (r, len, seg = QS.cylSeg, r2 = r) => new THREE.CylinderGeometry(r, r2, len, seg, 1);
const cylX = (r, len, seg, r2) => cyl(r, len, seg, r2).rotateZ(PI / 2);
const cylZ = (r, len, seg, r2) => cyl(r, len, seg, r2).rotateX(PI / 2);
const torus = (R, r, rs = 8, ts = QS.cylSeg) => new THREE.TorusGeometry(R, r, rs, ts);
const sphere = (r, ws = QS.cylSeg, hs = Math.max(6, QS.cylSeg >> 1)) => new THREE.SphereGeometry(r, ws, hs);

/** Cylinder (or box) spanning two points. */
function rodGeo(a, b, r, seg = QS.cylSeg) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const L = dir.length();
  dir.normalize();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, V(1, 1, 1));
  return xform(prep(g), m);
}
function boxBetween(a, b, w, d) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const L = dir.length();
  dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, V(1, 1, 1));
  return xform(prep(box(w, L, d)), m);
}

/**
 * Extrude a 2D shape drawn in the (z, y) side-view plane across the vehicle
 * from x0 to x1 (bevelled edges stay inside the outline).
 */
function extrudeX(shape, x0, x1, bevel = 0, bevelSeg = QS.bevelSeg, curveSeg = QS.curve) {
  const bt = bevel > 0 ? Math.min(bevel, (x1 - x0) * 0.45) : 0;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, x1 - x0 - 2 * bt),
    steps: 1,
    curveSegments: curveSeg,
    bevelEnabled: bt > 0,
    bevelThickness: bt,
    bevelSize: bt,
    bevelOffset: -bt,
    bevelSegments: bevelSeg,
  });
  // shape.x -> vehicle z, shape.y -> y, extrude z -> vehicle x
  const m = new THREE.Matrix4().set(
    0, 0, 1, x0 + bt,
    0, 1, 0, 0,
    1, 0, 0, 0,
    0, 0, 0, 1,
  );
  return xform(prep(geo), m);
}

/** Extrude a 2D shape drawn in the (x, y) front-view plane along z from z0 to z1. */
function extrudeZ(shape, z0, z1, bevel = 0) {
  const bt = bevel > 0 ? Math.min(bevel, (z1 - z0) * 0.45) : 0;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, z1 - z0 - 2 * bt),
    steps: 1,
    curveSegments: QS.curve,
    bevelEnabled: bt > 0,
    bevelThickness: bt,
    bevelSize: bt,
    bevelOffset: -bt,
    bevelSegments: QS.bevelSeg,
  });
  geo.translate(0, 0, z0 + bt);
  return prep(geo);
}

function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

/** Arc band (between radii r0 < r1) around centre (cz, cy) in the (z, y) plane. */
function arcBand(cz, cy, r0, r1, a0, a1) {
  const s = new THREE.Shape();
  s.moveTo(cz + Math.cos(a0) * r1, cy + Math.sin(a0) * r1);
  s.absarc(cz, cy, r1, a0, a1, false);
  s.lineTo(cz + Math.cos(a1) * r0, cy + Math.sin(a1) * r0);
  s.absarc(cz, cy, r0, a1, a0, true);
  return s;
}

/** Collects geometries per material key, then merges them into one mesh per key. */
class Bin {
  constructor() { this.map = new Map(); }
  add(key, geo, m) {
    const g = prep(geo);
    if (m) xform(g, m);
    let list = this.map.get(key);
    if (!list) { list = []; this.map.set(key, list); }
    list.push(g);
    return this;
  }
  build(parent, mats) {
    const meshes = [];
    for (const [key, geos] of this.map) {
      if (!geos.length) continue;
      const mat = mats[key];
      if (!mat) throw new Error(`crawlerModel: unknown material key "${key}"`);
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.castShadow = !NO_SHADOW.has(key);
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.map.clear();
    return meshes;
  }
}

/** Helix along +Y used for the coil-over springs. */
class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * PI * 2;
    return target.set(Math.cos(a) * this.radius, t * this.height, Math.sin(a) * this.radius);
  }
}

// -----------------------------------------------------------------------------
//  Procedural textures
// -----------------------------------------------------------------------------
function makeRubberTexture(size) {
  if (!size || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    // fine grain + occasional darker speckles (moulding texture)
    let v = 215 + rnd() * 40;
    if (rnd() < 0.04) v -= 50;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// metallic flake: fine roughness variation so the clear coat glints rather than looking like plastic
function makeFlakeTexture(size) {
  if (!size || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const v = 150 + rnd() * 70 + (rnd() < 0.03 ? -90 : 0);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

// raised rubber lettering around the tyre sidewall (planar ring UVs: canvas spans +-outer radius)
function makeSidewallTexture() {
  if (typeof document === 'undefined') return null;
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const R = (0.188 / 0.222) * (S / 2);   // text baseline radius in pixels
  const draw = (text, startAng, size, weight) => {
    g.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    let ang = startAng;
    for (const ch of text) {
      const w = g.measureText(ch).width;
      const da = (w + size * 0.06) / R;
      g.save();
      g.translate(S / 2 + Math.cos(ang + da / 2) * R, S / 2 + Math.sin(ang + da / 2) * R);
      g.rotate(ang + da / 2 + Math.PI / 2);
      // raised letter: light top edge, darker face
      g.fillStyle = 'rgba(92,90,86,1)'; g.fillText(ch, -w / 2, -1.5);
      g.fillStyle = 'rgba(52,51,49,1)'; g.fillText(ch, -w / 2, 0);
      g.restore();
      ang += da;
    }
    return ang;
  };
  g.textBaseline = 'middle';
  for (const base of [-Math.PI * 0.95, Math.PI * 0.05]) {
    let a = draw('MUD TERRAIN', base, 50, 800);
    a = draw('  •  ', a, 36, 600);
    draw('LT 2.2 RC CRAWLER', a, 34, 700);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// small square door badge (dark plate with a light emblem and a green bar)
function makeBadgeTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#222'; g.fillRect(4, 4, 56, 56);
  g.fillStyle = '#e8e8e4';
  g.beginPath(); g.moveTo(32, 14); g.lineTo(44, 40); g.lineTo(36, 40); g.lineTo(32, 30); g.lineTo(28, 40); g.lineTo(20, 40); g.closePath(); g.fill();
  g.fillStyle = '#5fbf2a'; g.fillRect(4, 50, 56, 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// outlined badge lettering (e.g. red RUBICON with a black edge)
function makeOutlineDecal(text, fill, stroke) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 640; c.height = 104;
  const g = c.getContext('2d');
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '900 86px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  const sx = Math.min(1, (c.width - 20) / g.measureText(text).width);
  g.save(); g.translate(c.width / 2, c.height / 2 + 4); g.scale(sx, 1);
  if (stroke) { g.lineWidth = 12; g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(text, 0, 0); }
  g.fillStyle = fill; g.fillText(text, 0, 0);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// worn white lettering for badges
function makeDecalTexture(main, sub) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = sub ? 116 : 170;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e6df';
  g.textBaseline = 'middle';
  g.font = `italic 900 ${sub ? 92 : 150}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
  const mw = g.measureText(main).width;
  if (sub) {
    g.fillText(main, 8, c.height / 2);
    g.font = '700 34px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    g.fillStyle = '#c9c5bc';
    g.fillText(sub, mw + 26, c.height / 2 + 18);
    g.fillRect(mw + 26, c.height / 2 - 14, 160, 6);
  } else g.fillText(main, (c.width - mw) / 2, c.height / 2);
  // weathering: knock out small flecks
  let seed = 99;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { g.globalAlpha = rnd() * 0.8; g.fillRect(rnd() * c.width, rnd() * c.height, rnd() * 5 + 1, rnd() * 3 + 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// -----------------------------------------------------------------------------
//  Dirt shader patch (dust / mud / wet) — height-masked in object space
// -----------------------------------------------------------------------------
const DIRT_FRAG_HEAD = /* glsl */`
uniform float uDust;
uniform float uMud;
uniform float uWet;
uniform float uDirtTop;
uniform float uBodyAO;
varying vec3 vDirtPos;
varying vec3 vDirtN;
float crwHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float crwNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(crwHash(i), crwHash(i + vec3(1,0,0)), f.x),
                 mix(crwHash(i + vec3(0,1,0)), crwHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(crwHash(i + vec3(0,0,1)), crwHash(i + vec3(1,0,1)), f.x),
                 mix(crwHash(i + vec3(0,1,1)), crwHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;
const DIRT_FRAG_BODY = /* glsl */`
{
  float lowMask = 1.0 - smoothstep(uDirtTop - 0.12, uDirtTop + 0.02, vDirtPos.y);
  float n = crwNoise(vDirtPos * 18.0) * 0.6 + crwNoise(vDirtPos * 61.0) * 0.4;
  float dustA = uDust * mix(0.12, 0.45, lowMask) * smoothstep(0.25, 0.8, n + 0.15);
  float mudA = clamp(uMud * lowMask * smoothstep(0.45, 0.7, n + uMud * 0.45), 0.0, 1.0);
  float wetA = uWet * mix(0.5, 1.0, lowMask);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.40, 0.32), dustA * 0.6);
  roughnessFactor = mix(roughnessFactor, 0.95, dustA);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.11, 0.07), mudA);
  roughnessFactor = mix(roughnessFactor, 0.5, mudA);
  metalnessFactor = mix(metalnessFactor, 0.0, max(mudA, dustA * 0.8));
  diffuseColor.rgb *= 1.0 - 0.45 * wetA;
  // sky occlusion: panels darken toward the underside and inside the wheel wells
  diffuseColor.rgb *= mix(1.0, mix(0.55, 1.0, smoothstep(-0.14, 0.32, vDirtPos.y)), uBodyAO);
  // downward-facing shell surfaces (fender/hood undersides, rocker returns) sit in deep shadow under the truck
  vec3 crwN = normalize(vDirtN);
  float crwDown = smoothstep(-0.2, -0.75, crwN.y);
  // inward-facing panel faces low down (inner fender walls seen through the wheel wells)
  crwDown = max(crwDown, smoothstep(0.3, 0.8, -sign(vDirtPos.x) * crwN.x) * step(0.05, abs(vDirtPos.x))
    * (1.0 - smoothstep(0.1, 0.16, vDirtPos.y)));
  diffuseColor.rgb *= mix(1.0, 1.0 - 0.8 * crwDown, uBodyAO);
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.25, wetA);
}
`;

function addDirt(mat, top, dirtU, ao = 0) {
  const topU = { value: top };
  const aoU = { value: ao };
  mat.userData.dirtTop = topU;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDust = dirtU.uDust;
    shader.uniforms.uMud = dirtU.uMud;
    shader.uniforms.uWet = dirtU.uWet;
    shader.uniforms.uDirtTop = topU;
    shader.uniforms.uBodyAO = aoU;
    shader.vertexShader = 'varying vec3 vDirtPos;\nvarying vec3 vDirtN;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvDirtPos = transformed;\n\tvDirtN = objectNormal;',
    );
    shader.fragmentShader = DIRT_FRAG_HEAD + shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\n' + DIRT_FRAG_BODY,
    );
  };
  mat.customProgramCacheKey = () => 'crawlerDirt' + ao;
}

// -----------------------------------------------------------------------------
//  Materials
// -----------------------------------------------------------------------------
function makeMaterials(bodyColor, dirtU) {
  const std = (p) => new THREE.MeshStandardMaterial(p);
  const rubberTex = makeRubberTexture(QS.texSize);

  // metallic base coat under a glossy clear coat; a faint flake texture breaks up the reflections
  const flake = makeFlakeTexture(QS.texSize);
  const paint = QS.clearcoat
    ? new THREE.MeshPhysicalMaterial({
      color: bodyColor, metalness: 0.04, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03,
      envMapIntensity: 1.15, roughnessMap: flake || null,
    })
    : std({ color: bodyColor, metalness: 0.04, roughness: 0.22, envMapIntensity: 1.1 });
  // moulded, grained plastic for flares/trim
  const grain = makeRubberTexture(QS.texSize);
  if (grain) grain.repeat.set(14, 14);

  const mats = {
    paint,
    black: std({ color: 0x1a1b1c, metalness: 0.0, roughness: 0.72, bumpMap: grain || null, bumpScale: 0.6 }), // textured plastic (flares, trims)
    steel: std({ color: 0x1d1e20, metalness: 0.35, roughness: 0.5, bumpMap: grain || null, bumpScale: 0.25 }), // black powder-coated steel
    trim: std({ color: 0x070707, metalness: 0.0, roughness: 0.9 }),              // rubber seals, panel gaps
    chrome: std({ color: 0xd8dade, metalness: 1.0, roughness: 0.12 }),
    alu: std({ color: 0x2e3033, metalness: 0.35, roughness: 0.55 }),            // dark moulded/anodised underbody parts (SCX30)
    grilleTrim: std({ color: 0x5f6368, metalness: 0.45, roughness: 0.42 }),       // grey slot frames
    gunmetal: std({ color: 0x4b4f54, metalness: 0.7, roughness: 0.32 }),         // headlamp bezels
    lensClear: std({ color: 0xffffff, metalness: 0.0, roughness: 0.02, transparent: true, opacity: 0.18, envMapIntensity: 2.0, depthWrite: false }),
    headDome: std({ color: 0xffffff, metalness: 0.0, roughness: 0.02, transparent: true, opacity: 0.06, envMapIntensity: 1.6, depthWrite: false }),  // thin clear headlamp lens
    silver: std({ color: 0xb4b8bd, metalness: 0.8, roughness: 0.28 }),          // grille slot rings, lamp bezels
    axle: std({ color: 0x232427, metalness: 0.08, roughness: 0.5 }),              // moulded black axle housings
    frame: std({ color: 0x18191b, metalness: 0.15, roughness: 0.58 }),            // satin black frame rails
    linkBlack: std({ color: 0x1e1f21, metalness: 0.05, roughness: 0.62 }),        // plastic links / knuckles
    shaftMetal: std({ color: 0x6f7378, metalness: 0.9, roughness: 0.34 }),         // driveshafts, steering rods, rod ends
    motorCan: std({ color: 0xc9ccd0, metalness: 0.95, roughness: 0.22 }),          // brushed motor can
    shock: std({ color: 0x34373c, metalness: 0.85, roughness: 0.28 }),
    spring: std({ color: 0x232426, metalness: 0.3, roughness: 0.55 }),
    bolt: std({ color: 0xc4c7cc, metalness: 1.0, roughness: 0.25 }),
    glass: std({
      color: 0x050608, metalness: 0.0, roughness: 0.05, envMapIntensity: 0.7,
      transparent: QS.interior, opacity: QS.interior ? 0.86 : 1.0,
    }),
    interior: std({ color: 0x232427, metalness: 0.0, roughness: 0.92 }),         // carpet / soft trim
    intTrim: std({ color: 0x1b1c1e, metalness: 0.05, roughness: 0.6 }),          // moulded black interior plastics
    seat: std({ color: 0x3b3d41, metalness: 0.0, roughness: 0.97, bumpMap: grain || null, bumpScale: 0.4 }),  // seat fabric
    red: std({ color: 0xd8391b, metalness: 0.0, roughness: 0.55 }),
    toolMetal: std({ color: 0x8c9094, metalness: 0.6, roughness: 0.42 }),       // painted/zinc tools
    canGrey: std({ color: 0xc9cbc8, metalness: 0.0, roughness: 0.6 }),
    orange: std({ color: 0xe0661a, metalness: 0.0, roughness: 0.6 }),
    canvas: std({ color: 0x4b4a33, metalness: 0.0, roughness: 0.95 }),
    rope: std({ color: 0x8e9194, metalness: 0.0, roughness: 0.95 }),
    rubber: std({
      color: 0x2f3032, metalness: 0.0, roughness: 0.93,
      map: rubberTex || null, roughnessMap: rubberTex || null, bumpMap: rubberTex || null, bumpScale: 0.8,
    }),
    rim: std({ color: 0x1c1d1f, metalness: 0.35, roughness: 0.55 }),
    headLens: std({ color: 0xc4cad0, metalness: 0.75, roughness: 0.12, emissive: 0xfff3e2, emissiveIntensity: 0 }),
    barLens: std({ color: 0xcfd6db, metalness: 0.3, roughness: 0.1, emissive: 0xf4f8ff, emissiveIntensity: 0 }),
    tailLens: std({ color: 0x5a0805, metalness: 0.1, roughness: 0.15, emissive: 0xff1a0a, emissiveIntensity: 0 }),
    brakeLens: std({ color: 0x5a0805, metalness: 0.1, roughness: 0.15, emissive: 0xff1a0a, emissiveIntensity: 0 }),
    amber: std({ color: 0x8a4a06, metalness: 0.1, roughness: 0.15, emissive: 0xff8a10, emissiveIntensity: 0 }),
    decalHood: std({ map: makeOutlineDecal('RUBICON', '#c8231b', '#141414'), transparent: true, alphaTest: 0.25, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    decalBadge: std({ map: makeBadgeTexture(), transparent: true, alphaTest: 0.2, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    glassLens: std({ color: 0x1a1d22, metalness: 0.2, roughness: 0.02, envMapIntensity: 2.5 }),
    sidewall: QS.texSize ? std({ color: 0xffffff, map: makeSidewallTexture(), transparent: true, alphaTest: 0.35, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false }) : null,
    decalRear: std({ map: makeOutlineDecal('SCX30', '#2a2a2a', null), transparent: true, alphaTest: 0.25, roughness: 0.5, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
  };

  // Height thresholds (object-local Y) below which mud collects.
  addDirt(mats.paint, 0.10, dirtU, 1);
  addDirt(mats.black, 0.16, dirtU, 1);
  addDirt(mats.steel, 0.15, dirtU, 1);
  for (const k of ['rubber', 'rim', 'axle', 'alu', 'shock', 'spring', 'bolt', 'linkBlack', 'shaftMetal', 'frame']) addDirt(mats[k], 10, dirtU);
  if (mats.sidewall) addDirt(mats.sidewall, 10, dirtU);
  for (const [k, m] of Object.entries(mats)) if (m) m.name = `crawler_${k}`;
  return mats;
}

// -----------------------------------------------------------------------------
//  Tyre: lathe carcass + staggered chevron lugs + shoulder/sidewall lugs, merged
//  into ONE geometry (axle along X, outer face toward +X).
// -----------------------------------------------------------------------------
function buildTireGeometry() {
  const parts = [];
  const prof = [
    [0.122, -0.074], [0.14, -0.082], [0.158, -0.087], [0.170, -0.090], [0.192, -0.093], [0.215, -0.095], [0.230, -0.092],
    [0.241, -0.085], [0.248, -0.070], [0.251, -0.040], [0.252, 0.0], [0.251, 0.040],
    [0.248, 0.070], [0.241, 0.085], [0.230, 0.092], [0.215, 0.095], [0.192, 0.093],
    [0.170, 0.090], [0.158, 0.087], [0.14, 0.082], [0.122, 0.074],
  ];
  const carcass = new THREE.LatheGeometry(prof.map(([r, a]) => new THREE.Vector2(r, a)), QS.tireSeg);
  carcass.rotateZ(-PI / 2);                        // lathe axis Y -> X
  parts.push(prep(carcass));

  // SCX30 stock tread: dense 'popcorn' lugs, small irregular rounded blocks, 5-6 across the tread in
  // staggered rows, following the rounded crown, with scalloped shoulder lugs running onto the sidewall.
  const N = QS.lugPitches;
  const rng = (() => { let t = 977; return () => ((t = (t * 16807) % 2147483647) / 2147483647); })();
  const jit = (a) => 1 + (rng() - 0.5) * 2 * a;
  const seg = QS.detail >= 3 ? 2 : 1;
  // carcass radius at axial offset |u| (from the lathe profile above)
  const crown = prof.slice(prof.length >> 1).map(([r, a2]) => [Math.abs(a2), r]).sort((p, q) => p[0] - q[0]);
  const carcassR = (u) => {
    u = Math.abs(u);
    for (let i = 0; i < crown.length - 1; i++) {
      const [a0, r0] = crown[i], [a1, r1] = crown[i + 1];
      if (u <= a1) return r0 + (r1 - r0) * ((u - a0) / (a1 - a0 || 1));
    }
    return crown[crown.length - 1][1];
  };
  const place = (g, u, r, phi, tiltZ, yaw) => {
    const m = new THREE.Matrix4().makeRotationX(phi)
      .multiply(new THREE.Matrix4().makeTranslation(u, r, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(tiltZ))
      .multiply(new THREE.Matrix4().makeRotationY(yaw));
    parts.push(prep(g).applyMatrix4(m));
  };
  // organic blob lug: squashed low-poly sphere sunk into the carcass (cheap, irregular, rounded)
  const blobDetail = QS.detail >= 1 ? 1 : 0;
  const blob = (w, h, len) => {
    let g = new THREE.IcosahedronGeometry(1, blobDetail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    const p = g.attributes.position, sd = rng() * 50;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // superellipsoid: push the sphere toward a block with soft edges and a flatter top
      x = Math.sign(x) * Math.abs(x) ** 0.42; y = Math.sign(y) * Math.abs(y) ** 0.5; z = Math.sign(z) * Math.abs(z) ** 0.42;
      const k = 1 + 0.05 * Math.sin(x * 5.3 + sd) * Math.cos(z * 4.7 - sd) + 0.03 * Math.sin(y * 6.1 + sd * 0.7);   // slight lumpiness
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.scale(w / 2, h, len / 2);
    g.computeVertexNormals();
    return g;
  };
  const lug = (u, phi, w, len, h) => {
    w *= jit(0.25); len *= jit(0.25); h *= jit(0.2);
    const rc = carcassR(u) - 0.002;
    const slope = (carcassR(u + 0.004) - carcassR(u - 0.004)) / 0.008;     // follow the rounded crown
    const tz = Math.atan(slope), yaw = (rng() - 0.5) * 0.6;
    place(blob(w, h, len), u + (rng() - 0.5) * 0.004, rc + h * 0.25, phi + (rng() - 0.5) * 0.02, tz, yaw);
    if (rng() < 0.35) place(blob(w * 0.45, h * 0.55, len * 0.45), u + (rng() - 0.5) * w * 0.5, rc + h * 0.95, phi + (rng() - 0.5) * 0.03, tz, 0);   // nub
  };
  const pitch = (2 * PI) / N;
  const across = [[-0.075, -0.045, -0.015, 0.015, 0.045, 0.075], [-0.06, -0.03, 0, 0.03, 0.06]];
  for (let i = 0; i < N; i++) {
    const phi = i * pitch;
    const row = across[i % 2];
    for (let k = 0; k < row.length; k++) {
      // occasionally two neighbours merge into one wider clump
      if (k < row.length - 1 && rng() < 0.22) { lug((row[k] + row[k + 1]) / 2, phi, 0.046, 0.027, 0.017); k++; continue; }
      lug(row[k], phi, 0.025, 0.028, 0.016);
    }
    // shoulder + sidewall scallops on both sides, alternating long/short
    for (const sd of [1, -1]) {
      const ph = phi + (sd > 0 ? 0 : pitch * 0.5);
      place(blob(0.03 * jit(0.15), 0.017, 0.033 * jit(0.15)), sd * 0.094, 0.234, ph, -sd * 0.95, (rng() - 0.5) * 0.4);
      if ((i + (sd > 0 ? 0 : 1)) % 2 === 0) place(blob(0.024 * jit(0.15), 0.013, 0.028 * jit(0.15)), sd * 0.1, 0.212, ph + pitch * 0.25, -sd * 1.3, (rng() - 0.5) * 0.4);
    }
  }

  const geo = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  // squeeze axially so the lugged tyre (lugs wrap the shoulders) stays 0.19 wide overall
  geo.scale(CRAWLER_DIMS.wheelWidth / 0.214, 1, 1);
  geo.computeBoundingSphere();
  return geo;
}

// -----------------------------------------------------------------------------
//  Beadlock wheel: returns { black, metal } geometries (axle along X, face +X)
// -----------------------------------------------------------------------------
function buildRimGeometries() {
  const black = new Bin();
  const D = QS.detail;

  // Barrel (closed thin profile so inner surface is visible through the spokes)
  const barrel = new THREE.LatheGeometry(
    [[0.150, -0.088], [0.162, -0.088], [0.162, -0.078], [0.156, -0.074], [0.156, 0.072], [0.150, 0.072], [0.150, -0.088]]
      .map(([r, a]) => new THREE.Vector2(r, a)),
    QS.tireSeg,
  );
  barrel.rotateZ(-PI / 2);
  black.add('rim', barrel);

  // Face: disc with a ring of round holes (SCX30 wheel style)
  const face = new THREE.Shape();
  face.absarc(0, 0, 0.153, 0, PI * 2, false);
  const nh = 8;
  for (let i = 0; i < nh; i++) {
    const c = (i / nh) * PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(c) * 0.103, Math.sin(c) * 0.103, 0.027, 0, PI * 2, true);
    face.holes.push(h);
  }
  black.add('rim', extrudeX(face, 0.056, 0.072, 0.003, Math.min(2, QS.bevelSeg), Math.max(6, QS.curve >> 1)));
  // raised inner ring
  const ir = new THREE.Shape(); ir.absarc(0, 0, 0.07, 0, PI * 2, false);
  const irh = new THREE.Path(); irh.absarc(0, 0, 0.055, 0, PI * 2, true); ir.holes.push(irh);
  black.add('rim', extrudeX(ir, 0.07, 0.078, 0.002, 1, Math.max(8, QS.curve)));

  // Hub boss
  black.add('rim', cylX(0.042, 0.03, QS.cylSeg), M(0.066, 0, 0));

  // Beadlock rings (outer, and inner on high+)
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.193, 0, PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.150, 0, PI * 2, true);
  ring.holes.push(hole);
  const ringSeg = Math.max(12, QS.tireSeg >> 1);
  black.add('rim', extrudeX(ring, 0.087, 0.100, 0.002, 1, ringSeg));
  if (D >= 2) black.add('rim', extrudeX(ring, -0.100, -0.088, 0.002, 1, ringSeg));

  // Metal: hex nut, beadlock bolts, valve stem
  const metal = new Bin();
  metal.add('bolt', cylX(0.017, 0.014, 6), M(0.087, 0, 0));
  metal.add('bolt', cylX(0.009, 0.006, 10), M(0.096, 0, 0));
  const nb = QS.beadBolts;
  for (let j = 0; j < nb; j++) {
    const a = (j / nb) * PI * 2;
    metal.add('bolt', cylX(0.0055, 0.006, 6), M(0.1025, Math.cos(a) * 0.1715, Math.sin(a) * 0.1715));
  }
  if (D >= 2) metal.add('bolt', cylX(0.004, 0.02, 6), M(0.08, 0.143, 0.02));

  const grab = (bin, key) => {
    const list = bin.map.get(key) || [];
    const g = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (list.length > 1) list.forEach((x) => x.dispose());
    bin.map.clear();
    if (g) {
      g.scale(CRAWLER_DIMS.wheelWidth / 0.214, 0.79, 0.79);   // match the tyre's axial squeeze; small 1.0in wheel in a tall sidewall
      g.computeBoundingSphere();
    }
    return g;
  };
  return { black: grab(black, 'rim'), metal: grab(metal, 'bolt') };
}

// -----------------------------------------------------------------------------
//  Sprung body / chassis (static, merged per material)
// -----------------------------------------------------------------------------
const FRONT_ARCH = { cz: AXLE_Z[0], cy: REST_Y, r: 0.31 };
const REAR_ARCH = { cz: AXLE_Z[1], cy: REST_Y, r: 0.32 };

function buildBody(B) {
  const D = QS.detail;
  const sides = [1, -1];
  const archY = (z, a) => a.cy + Math.sqrt(Math.max(0, a.r * a.r - (z - a.cz) ** 2));
  const archAng = (z, y, a) => Math.atan2(y - a.cy, z - a.cz);

  // ===========================================================================
  //  Upper body — Axial SCX30 Jeep Wrangler JLU, dimensioned from the product side photo
  //  (wheelbase 1.12 = 425 px; ground at local y = -0.298 with 0.198-radius tyres).
  // ===========================================================================
  const FA = { cz: AXLE_Z[0], cy: REST_Y, r: 0.262 };    // front arch (flare outer)
  const RA = { cz: AXLE_Z[1], cy: REST_Y, r: 0.262 };    // rear arch
  const zNose = 0.738, zFenderRear = 0.285, zBack = -0.757;
  const yBot = -0.03, yBelt = 0.258, yWinTop = 0.408, yRoof = 0.452;
  const xBody = 0.298;

  // Rear JL wheel opening, mirrored character of the front: long sloping front leg up from the rocker,
  // flat top over the tyre, short near-vertical rear leg down to the bumper corner (traced from the side photo).
  const rearOpen = new THREE.CatmullRomCurve3([
    V(0, yBot, -0.302), V(0, 0.045, -0.34), V(0, 0.1, -0.374), V(0, 0.13, -0.41), V(0, 0.143, -0.46),
    V(0, 0.146, -0.56), V(0, 0.143, -0.655), V(0, 0.128, -0.69), V(0, 0.1, -0.708), V(0, 0.062, -0.718),
  ], false, 'centripetal').getSpacedPoints(40 + 20 * QS.detail).map((p) => [p.z, p.y]);
  // offset a polyline away from a hub centre (outward normal)
  const offsetFrom = (pts, hub, d) => pts.map((p, i) => {
    const a0 = pts[Math.max(0, i - 1)], a1 = pts[Math.min(pts.length - 1, i + 1)];
    let nz = -(a1[1] - a0[1]), ny = a1[0] - a0[0];
    const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
    if (nz * (p[0] - hub[0]) + ny * (p[1] - hub[1]) < 0) { nz = -nz; ny = -ny; }
    return [p[0] + nz * d, p[1] + ny * d];
  });

  // ------------------------------------------------------------ Tub ---------
  {
    const s = new THREE.Shape();
    const yCorner = rearOpen[rearOpen.length - 1][1];
    s.moveTo(zFenderRear, yBot);
    s.lineTo(zFenderRear, yBelt);
    s.lineTo(zBack, yBelt);
    s.lineTo(zBack, yCorner);
    for (const [z, y] of rearOpen.slice().reverse()) s.lineTo(z, y);
    s.lineTo(zFenderRear, yBot);
    B.add('paint', extrudeX(s, -xBody, xBody, 0.032, Math.max(4, QS.bevelSeg + 2)));
  }

  // ---------------------------------------- Front fenders + JL flares -------
  // The JL front wheel opening is flat-topped: a short front leg at the nose, a nearly level top over the
  // tyre, then a long sloping rear leg down to the rocker (traced from the product photo).
  {
    const open = new THREE.CatmullRomCurve3([
      V(0, 0.118, 0.735), V(0, 0.148, 0.716), V(0, 0.16, 0.665), V(0, 0.166, 0.55), V(0, 0.168, 0.45),
      V(0, 0.15, 0.392), V(0, 0.085, 0.345), V(0, 0.01, 0.312), V(0, yBot, 0.298),
    ], false, 'centripetal');
    const N = 40 + 20 * QS.detail;
    const inner = open.getSpacedPoints(N).map((p) => [p.z, p.y]);
    const hub = [FA.cz, FA.cy];
    // offset a polyline away from the hub (outward normal)
    const offset = (pts, d) => pts.map((p, i) => {
      const a0 = pts[Math.max(0, i - 1)], a1 = pts[Math.min(pts.length - 1, i + 1)];
      let nz = -(a1[1] - a0[1]), ny = a1[0] - a0[0];
      const l = Math.hypot(nz, ny) || 1; nz /= l; ny /= l;
      if (nz * (p[0] - hub[0]) + ny * (p[1] - hub[1]) < 0) { nz = -nz; ny = -ny; }
      return [p[0] + nz * d, p[1] + ny * d];
    });
    // white fender: top just under the hood line, rounded nose, cut along the opening
    const f = new THREE.Shape();
    f.moveTo(zFenderRear, yBelt + 0.004);
    // fender tops run level with the hood edge and roll down over a rounded nose to the flare tip
    f.lineTo(0.66, 0.257);
    f.quadraticCurveTo(0.728, 0.255, zNose - 0.004, 0.226);
    // below the black flare cap the nose steps back inside the cap, so no white shows under it beside the lamp
    f.lineTo(zNose - 0.004, 0.152);
    f.lineTo(0.68, 0.152);
    for (const [z, y] of inner) if (z < 0.68) f.lineTo(z, y);
    f.lineTo(zFenderRear, yBot);
    f.lineTo(zFenderRear, yBelt + 0.004);
    // generous roll on the top/outer edge and nose, smooth-shaded (creases kept only at genuinely sharp corners)
    const fSeg = Math.max(5, QS.bevelSeg + 4), fCurve = 16 + 4 * QS.detail;
    for (const s2 of sides) B.add('paint', toCreasedNormals(s2 > 0 ? extrudeX(f, 0.234, 0.334, 0.044, fSeg, fCurve) : extrudeX(f, -0.334, -0.234, 0.044, fSeg, fCurve), 0.7));
    // black flare: a slim band following the opening, standing proud of the fender
    const outerPts = offset(inner, 0.03);
    const fl = new THREE.Shape();
    fl.moveTo(outerPts[0][0], outerPts[0][1]);
    for (const [z, y] of outerPts.slice(1)) fl.lineTo(z, y);
    for (const [z, y] of inner.slice().reverse()) fl.lineTo(z, y);
    for (const s2 of sides) B.add('black', s2 > 0 ? extrudeX(fl, 0.305, 0.366, 0.008, Math.min(2, QS.bevelSeg)) : extrudeX(fl, -0.366, -0.305, 0.008, Math.min(2, QS.bevelSeg)));
    // dark wheel-well liner just inside the opening
    const ln = new THREE.Shape();
    const lin = offset(inner, -0.012);
    ln.moveTo(inner[0][0], inner[0][1]);
    for (const [z, y] of inner.slice(1)) ln.lineTo(z, y);
    for (const [z, y] of lin.slice().reverse()) ln.lineTo(z, y);
    B.add('trim', extrudeX(ln, 0.24, 0.31));
    B.add('trim', extrudeX(ln, -0.31, -0.24));
    // round amber side marker on the fender, behind the wheel
    for (const s2 of sides) B.add('amber', cylX(0.009, 0.004, 12), M(s2 * 0.336, 0.205, 0.33));
  }

  // ------------------------------------------------- Rear flares + liner -----
  {
    const hub = [RA.cz, RA.cy];
    // slim black flare band following the opening, standing proud of the body (same section as the front)
    const outer = offsetFrom(rearOpen, hub, 0.03);
    const fl = new THREE.Shape();
    fl.moveTo(outer[0][0], outer[0][1]);
    for (const [z, y] of outer.slice(1)) fl.lineTo(z, y);
    for (const [z, y] of rearOpen.slice().reverse()) fl.lineTo(z, y);
    for (const s2 of sides) B.add('black', s2 > 0 ? extrudeX(fl, 0.284, 0.366, 0.008, Math.min(2, QS.bevelSeg)) : extrudeX(fl, -0.366, -0.284, 0.008, Math.min(2, QS.bevelSeg)));
    // dark wheel-well liner just inside the opening
    const lin = offsetFrom(rearOpen, hub, -0.012);
    const ln = new THREE.Shape();
    ln.moveTo(rearOpen[0][0], rearOpen[0][1]);
    for (const [z, y] of rearOpen.slice(1)) ln.lineTo(z, y);
    for (const [z, y] of lin.slice().reverse()) ln.lineTo(z, y);
    B.add('trim', extrudeX(ln, -0.29, 0.29));
  }

  // --------------------------------------------------- Hood (crowned) --------
  {
    const s = new THREE.Shape();
    s.moveTo(zFenderRear, 0.12);
    s.lineTo(zFenderRear, 0.266);
    s.lineTo(0.68, 0.261);
    s.quadraticCurveTo(0.725, 0.259, zNose, 0.238);   // flatter nose: hood carries forward, then a thin lip
    s.lineTo(zNose - 0.004, 0.226);            // underside of the hood lip
    s.lineTo(zNose - 0.07, 0.222);
    s.lineTo(zNose - 0.07, 0.12);
    B.add('paint', extrudeX(s, -0.234, 0.234, 0.014, Math.max(4, QS.bevelSeg + 2)));
    const halfW = 0.232;
    const baseY = (z) => z <= 0.68 ? 0.266 + (0.261 - 0.266) * (z - zFenderRear) / (0.68 - zFenderRear)
      : (() => { const t = (z - 0.68) / (zNose - 0.68); return (1 - t) * (1 - t) * 0.261 + 2 * (1 - t) * t * 0.259 + t * t * 0.238; })();
    const sst = (a0, a1, x) => { const t = Math.min(1, Math.max(0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t); };
    const domeAt = (x, z) => sst(0.14, 0.095, Math.abs(x)) * sst(0.31, 0.38, z) * (1 - sst(0.62, 0.68, z));
    const hoodY = (x, z) => baseY(z) + (1 - sst(0.66, 0.72, z)) * (0.006 * (1 - (x / halfW) ** 2) + 0.014 * domeAt(x, z)) - 0.018 * sst(0.2, 0.236, Math.abs(x)) ** 2;
    const nu = 2 + 22 * Math.max(1, QS.detail), nv = 2 + 26 * Math.max(1, QS.detail);
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      const z = zFenderRear + 0.002 + (zNose - 0.012 - zFenderRear) * (j / nv);
      for (let i = 0; i <= nu; i++) { const x = -halfW + 2 * halfW * (i / nu); pos.push(x, hoodY(x, z) + 0.0006, z); uv.push(x * 2, z * 2); }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a0 = j * (nu + 1) + i, c0 = a0 + nu + 1; idx.push(a0, c0, a0 + 1, a0 + 1, c0, c0 + 1); }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hg.setIndex(idx);
    hg.computeVertexNormals();
    B.add('paint', hg);
    const onHood = (key, geo, x, z, lift = 0) => {
      const dz = 0.004, sl = Math.atan2(hoodY(x, z - dz) - hoodY(x, z + dz), 2 * dz);
      B.add(key, geo, M(x, hoodY(x, z) + lift, z, sl));
    };
    // twin heat-extractor vents at the front corners of the hood
    for (const s2 of sides) {
      onHood('black', rbox(0.06, 0.004, 0.07, 0.006), s2 * 0.165, 0.36, 0.001);
      for (let i = 0; i < 4; i++) onHood('black', box(0.05, 0.004, 0.0035), s2 * 0.165, 0.338 + i * 0.015, 0.0035);
      B.add('black', rbox(0.006, 0.02, 0.014, 0.003), M(s2 * 0.2375, 0.252, 0.66));   // hood latch
      B.add('grilleTrim', box(0.0016, 0.0015, 0.38), M(s2 * 0.235, 0.2565, 0.47));      // hood / fender shut line (fine gap)
    }
    B.add('black', box(0.46, 0.008, 0.028), M(0, 0.268, zFenderRear + 0.012));    // cowl
    // wipers
    for (const wx of [0.06, -0.12]) B.add('black', box(0.17, 0.005, 0.005), M(wx, 0.276, 0.262, 0, 0, 0.08));
  }

  // ------------------------------------------- Grille + headlamps ------------
  // From the front photo: 7 full-height slots between two large round lamps at the grille's outer edges,
  // each slot ringed in silver; small slatted vents under the lamps; body-colour surround.
  {
    const gy0 = 0.074, gy1 = 0.218, gw = 0.242;
    const curve = 0.32, rake = 0.13;          // face wraps back toward the corners
    const faceZ = (x, y) => zNose - 0.006 - curve * x * x - (y - gy0) * rake;
    // bend an extrusion (shape in front view, depth along +z) onto the grille surface
    // outlines are resampled densely first so long straight edges actually follow the curved face
    const dense = (sh, n) => {
      const out = new THREE.Shape(sh.getSpacedPoints(n));
      out.holes = sh.holes.map((h) => new THREE.Path(h.getSpacedPoints(Math.max(28, Math.round(n * h.getLength() / sh.getLength())))));
      return out;
    };
    const bent = (shape, depth, front, bevel = 0.0015, n = 0) => {
      const src = n ? dense(shape, n) : shape;
      const g = new THREE.ExtrudeGeometry(src, { depth, bevelEnabled: depth > 0.004, bevelThickness: bevel, bevelSize: bevel, bevelOffset: n ? -bevel : 0, bevelSegments: bevel > 0.002 ? 3 + QS.detail : 1, curveSegments: 8 + 3 * QS.detail });
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, faceZ(p.getX(i), p.getY(i)) - depth + p.getZ(i) + front);
      return toCreasedNormals(g, 0.75);
    };
    const capsule = (path, cx, ya, yb, w) => {
      const r = w / 2;
      path.moveTo(cx - r, ya + r);
      path.lineTo(cx - r, yb - r);
      path.absarc(cx, yb - r, r, PI, 0, true);
      path.lineTo(cx + r, ya + r);
      path.absarc(cx, ya + r, r, 0, PI, true);
      return path;
    };
    const rrect = (path, x0, y0, x1, y1, r) => {
      path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
      path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1); path.lineTo(x0 + r, y1);
      path.quadraticCurveTo(x0, y1, x0, y1 - r); path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
      return path;
    };
    // thick white surround with rounded edges
    const gTop = gy1 + 0.006;
    // shield outline: big rounded lower corners, tighter top corners
    const panel = new THREE.Shape();
    {
      const rb = 0.055, rt = 0.03, gb = gw - 0.004;
      panel.moveTo(-gb + rb, gy0); panel.lineTo(gb - rb, gy0);
      panel.bezierCurveTo(gb - rb * 0.35, gy0, gw, gy0 + rb * 0.4, gw, gy0 + rb);
      panel.lineTo(gw, gTop - rt); panel.quadraticCurveTo(gw, gTop, gw - rt, gTop);
      panel.lineTo(-gw + rt, gTop); panel.quadraticCurveTo(-gw, gTop, -gw, gTop - rt);
      panel.lineTo(-gw, gy0 + rb);
      panel.bezierCurveTo(-gw, gy0 + rb * 0.4, -gb + rb * 0.35, gy0, -gb + rb, gy0);
    }
    const lampX = 0.19, lampY = 0.158, lampR = 0.043;
    const pocketY = lampY, pocketR = lampR + 0.0035;                 // thin dark recess ring around each lamp
    const slotW = 0.026, slotY0 = 0.09, slotY1 = 0.206, pitch = 0.0385;
    const sx = (i) => (i - 3) * pitch;
    for (let i = 0; i < 7; i++) panel.holes.push(rrect(new THREE.Path(), sx(i) - slotW / 2 - 0.0055, slotY0 - 0.005, sx(i) + slotW / 2 + 0.0055, slotY1 + 0.005, 0.01));
    for (const s2 of sides) panel.holes.push(new THREE.Path().absarc(s2 * lampX, pocketY, pocketR, 0, PI * 2, true));
    // puffy surround: a fine grid over the curved face, trimmed and edge-snapped by a signed-distance field
    // (shield outline, slot and lamp openings), with every edge rolled back like moulded plastic
    {
      const gcy = (gy0 + gTop) / 2, ghy = (gTop - gy0) / 2;
      const sdRound = (px, py, hx, hy, r) => {
        const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      };
      const slotHX = slotW / 2 + 0.0022, slotHY = (slotY1 - slotY0) / 2 + 0.002, slotCY = (slotY0 + slotY1) / 2;
      const ROUT = 0.011, RIN = 0.0045;
      // returns [distance (positive inside the white), roll radius of the nearest edge]
      const field = (x, y) => {
        const dOut = -sdRound(x, y - gcy, gw, ghy, y < gcy ? 0.055 : 0.03);
        let d = dOut, r = ROUT;
        for (let i = 0; i < 7; i++) { const di = sdRound(x - sx(i), y - slotCY, slotHX, slotHY, 0.009); if (di < d) { d = di; r = RIN; } }
        for (const s2 of sides) { const di = Math.hypot(x - s2 * lampX, y - pocketY) - pocketR; if (di < d) { d = di; r = RIN; } }
        return [d, r];
      };
      const cell = QS.detail >= 2 ? 0.0014 : QS.detail >= 1 ? 0.002 : 0.003;
      const nx = Math.ceil((2 * gw + 0.01) / cell), ny = Math.ceil((2 * ghy + 0.01) / cell);
      const x0 = -gw - 0.005, y0g = gy0 - 0.005;
      const pos = new Float32Array((nx + 1) * (ny + 1) * 3), dist = new Float32Array((nx + 1) * (ny + 1));
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        let x = x0 + i * cell, y = y0g + j * cell;
        const d0 = field(x, y)[0];
        dist[k] = d0;
        // snap vertices near/outside the edge onto the zero contour (two Newton steps along the gradient)
        if (d0 < cell * 0.6) {
          for (let it = 0; it < 2; it++) {
            const e = 1e-4, f = field(x, y)[0];
            const gx = (field(x + e, y)[0] - field(x - e, y)[0]) / (2 * e), gyv = (field(x, y + e)[0] - field(x, y - e)[0]) / (2 * e);
            const gl = Math.hypot(gx, gyv) || 1;
            x -= (gx / gl) * f; y -= (gyv / gl) * f;
          }
        }
        const [d, r] = field(x, y);
        const dd = Math.min(Math.max(d, 0), r);
        const roll = -(r - Math.sqrt(Math.max(0, r * r - (r - dd) * (r - dd))));
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = faceZ(x, y) + roll;
      }
      const idx = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a0 = j * (nx + 1) + i, b0 = a0 + 1, c0 = a0 + nx + 1, d0 = c0 + 1;
        if (dist[a0] + dist[c0] + dist[b0] > 0) idx.push(a0, b0, c0);
        if (dist[b0] + dist[d0] + dist[c0] > 0) idx.push(b0, d0, c0);
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      gg.setIndex(idx);
      gg.computeVertexNormals();
      B.add('paint', gg);
    }
    // dark-grey frame around each slot (lines the slot walls, nearly touching its neighbours)
    for (let i = 0; i < 7; i++) {
      const fr = rrect(new THREE.Shape(), sx(i) - slotW / 2 - 0.0055, slotY0 - 0.005, sx(i) + slotW / 2 + 0.0055, slotY1 + 0.005, 0.01);
      fr.holes.push(rrect(new THREE.Path(), sx(i) - slotW / 2, slotY0, sx(i) + slotW / 2, slotY1, 0.006));
      B.add('grilleTrim', bent(fr, 0.014, -0.003, 0.0015, 48));
    }
    // dark cavity behind the openings
    B.add('trim', rbox(0.47, 0.15, 0.008, 0.01), M(0, 0.148, zNose - 0.058));
    B.add('trim', box(0.47, 0.006, 0.05), M(0, gTop, zNose - 0.035));
    // headlamps (JL LED style, as in the photo): bright chrome bezel, dark gloss housing with horizontal chrome
    // reflector blades, central projector in a chrome cup, LED halo ring, clear domed lens
    const lean = -Math.atan(rake);
    for (const s2 of sides) {
      const x = s2 * lampX, z = faceZ(x, lampY);
      const yaw = s2 * Math.atan(2 * curve * lampX);
      const L = (geo, dz) => B.add(geo[0], geo[1], M(x, lampY, z + dz, lean, yaw, 0));
      B.add('trim', cylZ(pocketR, 0.03), M(x, pocketY, faceZ(x, pocketY) - 0.038, lean, yaw, 0));   // recess behind the housing
      L(['silver', torus(lampR - 0.0015, 0.0052, 10, QS.cylSeg + 12)], -0.005);          // chrome bezel
      L(['trim', torus(lampR - 0.0075, 0.0016, 6, QS.cylSeg + 12)], -0.006);             // dark gap inside the bezel
      L(['trim', cylZ(lampR - 0.006, 0.004, QS.cylSeg + 8)], -0.02);                      // deep black housing
      // stacked chrome reflector blades, clipped to the round housing, each tilted to catch the light
      const inner = lampR - 0.01;
      for (const dy of [-0.021, -0.0105, 0.0105, 0.021]) {
        const w = 2 * Math.sqrt(Math.max(0, inner * inner - dy * dy)) * (Math.abs(dy) > 0.015 ? 0.86 : 0.5);
        const gx = Math.abs(dy) > 0.015 ? 0 : s2 * 0.012;                                   // middle blades sit beside the projector
        L(['chrome', rbox(w, 0.0048, 0.003, 0.0014).rotateX(dy > 0 ? 0.35 : -0.35).translate(gx, dy, 0)], -0.0165);
      }
      // projector: chrome cup + lens (glows with the lights)
      L(['chrome', torus(0.0095, 0.0022, 6, QS.cylSeg + 4).translate(-s2 * 0.009, 0, 0)], -0.0145);
      L(['headLens', cylZ(0.0085, 0.004, QS.cylSeg).translate(-s2 * 0.009, 0, 0)], -0.0155);
      L(['headLens', torus(lampR - 0.0095, 0.0011, 6, QS.cylSeg + 8)], -0.012);          // LED halo ring
      L(['headDome', sphere(lampR - 0.006, QS.cylSeg + 6, 10).scale(1, 1, 0.22)], -0.009);
    }
    B.add('black', rbox(0.44, 0.022, 0.03, 0.008), M(0, 0.07, zNose - 0.03));
    // black fender corners either side of the grille, with clear marker strips underneath
    // black flare nose: the flare's front end wraps up and around the fender nose beside the grille
    const cap = new THREE.Shape();
    // short rounded flare tip (not a block): front face beside the lamp, top rolling back into the arch band
    cap.moveTo(zNose - 0.07, 0.128);
    cap.lineTo(zNose - 0.002, 0.128);
    cap.lineTo(zNose + 0.001, 0.164);
    cap.quadraticCurveTo(zNose, 0.18, zNose - 0.018, 0.183);
    cap.quadraticCurveTo(zNose - 0.045, 0.184, zNose - 0.07, 0.165);
    cap.lineTo(zNose - 0.07, 0.128);
    for (const s2 of sides) {
      B.add('black', s2 > 0 ? extrudeX(cap, 0.243, 0.368, 0.012, 3) : extrudeX(cap, -0.368, -0.243, 0.012, 3));
      B.add('barLens', rbox(0.09, 0.007, 0.036, 0.003), M(s2 * 0.31, 0.123, zNose - 0.02));   // clear marker strip under the block
    }
  }

  // ------------------------------------------ Greenhouse + hardtop -----------
  {
    const zWsBase = 0.24, zWsTop = 0.133;
    // tinted glass volume
    B.add('glass', extrudeX(polyShape([[zWsBase, yBelt], [zWsTop, yWinTop + 0.006], [zBack + 0.012, yWinTop + 0.006], [zBack + 0.012, yBelt]]), -0.283, 0.283, 0.016, 4));
    // hardtop roof (white) with rolled edges
    B.add('paint', rbox(0.604, 0.048, zWsTop - zBack + 0.014, 0.022, 4), M(0, yRoof - 0.024, (zWsTop + zBack) / 2 - 0.004));
    B.add('paint', rbox(0.54, 0.012, zWsTop - zBack - 0.05, 0.006, 3), M(0, yRoof + 0.002, (zWsTop + zBack) / 2 - 0.01));
    if (D >= 1) {
      B.add('trim', box(0.56, 0.003, 0.004), M(0, yRoof + 0.0075, -0.08));
      B.add('trim', box(0.004, 0.003, 0.2), M(0, yRoof + 0.0075, 0.025));
    }
    // black windshield frame (A-pillars + header + base)
    const rake = -Math.atan2(zWsBase - zWsTop, yWinTop - yBelt);
    const wsLen = Math.hypot(zWsBase - zWsTop, yWinTop - yBelt);
    for (const s2 of sides) B.add('black', rbox(0.03, wsLen + 0.02, 0.024, 0.006), M(s2 * 0.274, (yBelt + yWinTop) / 2, (zWsBase + zWsTop) / 2, rake));
    B.add('black', rbox(0.57, 0.026, 0.03, 0.006), M(0, yWinTop + 0.004, zWsTop + 0.004));
    B.add('black', box(0.55, 0.016, 0.026), M(0, yBelt + 0.006, zWsBase - 0.004, rake));
    // side window surrounds: body-colour panel with three rounded openings per side (front door, rear door,
    // rear quarter), each ringed by a black rubber seal (as on the product photos)
    const roundedPoly = (path, pts, r) => {
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
        const ri = Array.isArray(r) ? r[i] : r;
        const d0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const a2 = [p1[0] + (p0[0] - p1[0]) / d0 * ri, p1[1] + (p0[1] - p1[1]) / d0 * ri];
        const b2 = [p1[0] + (p2[0] - p1[0]) / d2 * ri, p1[1] + (p2[1] - p1[1]) / d2 * ri];
        if (i === 0) path.moveTo(a2[0], a2[1]); else path.lineTo(a2[0], a2[1]);
        path.quadraticCurveTo(p1[0], p1[1], b2[0], b2[1]);
      }
      path.closePath();
      return path;
    };
    const inset = (pts, d) => {
      const cz = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
      return pts.map(([z, y]) => [z + Math.sign(cz - z) * d, y + Math.sign(cy - y) * d]);
    };
    const yS0 = yBelt + 0.016, yS1 = yWinTop - 0.01;
    const aPill = (y) => zWsBase - (y - yBelt) * ((zWsBase - zWsTop) / (yWinTop - yBelt)) - 0.022;   // just behind the A-pillar
    const openings = [
      { pts: [[aPill(yS0), yS0], [aPill(yS1), yS1], [-0.04, yS1], [-0.04, yS0]], r: [0.008, 0.012, 0.016, 0.01] },   // front door
      { pts: [[-0.085, yS0], [-0.085, yS1], [-0.32, yS1], [-0.32, yS0]], r: 0.016 },                               // rear door
      { pts: [[-0.36, yS0], [-0.36, yS1], [-0.715, yS1], [-0.715, yS0]], r: [0.012, 0.014, 0.04, 0.012] },       // rear quarter
    ];
    const frame = new THREE.Shape();
    frame.moveTo(aPill(yBelt) + 0.016, yBelt);
    frame.lineTo(aPill(yWinTop + 0.012) + 0.016, yWinTop + 0.012);
    frame.lineTo(zBack + 0.002, yWinTop + 0.012);
    frame.lineTo(zBack + 0.002, yBelt);
    frame.closePath();
    for (const o of openings) frame.holes.push(roundedPoly(new THREE.Path(), o.pts, o.r));
    for (const s2 of sides) {
      B.add('paint', s2 > 0 ? extrudeX(frame, 0.2832, 0.2892, 0.0015, 1, 8) : extrudeX(frame, -0.2892, -0.2832, 0.0015, 1, 8));
      for (const o of openings) {
        const seal = roundedPoly(new THREE.Shape(), o.pts, o.r);
        const rIn = (Array.isArray(o.r) ? o.r : o.pts.map(() => o.r)).map((r) => Math.max(0.003, r - 0.004));
        seal.holes.push(roundedPoly(new THREE.Path(), inset(o.pts, 0.0045), rIn));
        B.add('trim', s2 > 0 ? extrudeX(seal, 0.2834, 0.2902, 0.001, 1, 8) : extrudeX(seal, -0.2902, -0.2834, 0.001, 1, 8));
      }
    }
    for (const s2 of sides) {
      // mirror on the front door (black)
      // short cast arm off the door's front corner, tall rounded head close to the A-pillar
      B.add('black', rbox(0.02, 0.014, 0.026, 0.005), M(s2 * 0.292, 0.284, 0.226));
      B.add('black', rodGeo(V(s2 * 0.296, 0.286, 0.222), V(s2 * 0.326, 0.302, 0.216), 0.0065));
      B.add('black', rbox(0.044, 0.066, 0.028, 0.012), M(s2 * 0.346, 0.318, 0.212, 0, s2 * 0.14, 0));
      B.add('glass', rbox(0.034, 0.054, 0.002, 0.008), M(s2 * 0.346, 0.318, 0.1975, 0, s2 * 0.14, 0));
    }
    // tailgate glass surround: body-colour panel with a rounded opening and black seal
    {
      const rw = 0.228, ry0 = yBelt + 0.018, ry1 = yWinTop - 0.012;
      const rearPts = [[-rw, ry0], [rw, ry0], [rw, ry1], [-rw, ry1]];
      const rp = new THREE.Shape();
      rp.moveTo(-0.293, yBelt); rp.lineTo(0.293, yBelt); rp.lineTo(0.293, yWinTop + 0.012); rp.lineTo(-0.293, yWinTop + 0.012); rp.closePath();
      rp.holes.push(roundedPoly(new THREE.Path(), rearPts, 0.022));
      B.add('paint', extrudeZ(rp, zBack + 0.004, zBack + 0.01, 0.0015));
      const rs = roundedPoly(new THREE.Shape(), rearPts, 0.022);
      rs.holes.push(roundedPoly(new THREE.Path(), rearPts.map(([x, y]) => [x - Math.sign(x) * 0.0045, y + (y < (ry0 + ry1) / 2 ? 0.0045 : -0.0045)]), 0.018));
      B.add('trim', extrudeZ(rs, zBack + 0.003, zBack + 0.0105, 0.001));
    }
  }

  // ---------------------------------------- Curved door skins + hardware ----
  // JL doors bulge outward through the middle, with a crisp character line just below the glass, and tuck
  // back toward the rocker. A curved skin sits over the flat tub side; hardware is seated on its surface.
  const skinY0 = yBot + 0.026, skinY1 = yBelt - 0.026;
  const skinZ0 = zBack + 0.034, skinZ1 = zFenderRear - 0.008;
  const sstep = (a0, a1, x) => { const t = Math.min(1, Math.max(0, (x - a0) / (a1 - a0))); return t * t * (3 - 2 * t); };
  const bulgeY = (y) => {
    const t = (y - skinY0) / (skinY1 - skinY0);
    if (t <= 0 || t >= 1) return 0;
    const belly = Math.sin(PI * Math.pow(t, 0.8));                     // fullest just below mid-height
    const crease = Math.exp(-(((t - 0.83) / 0.045) ** 2));             // character line under the windows
    return 0.0095 * belly + 0.0022 * crease;
  };
  const bulge = (z, y) => bulgeY(y) * sstep(skinZ0, skinZ0 + 0.06, z) * (1 - sstep(skinZ1 - 0.05, skinZ1, z));
  const surfX = (z, y) => xBody + 0.0009 + bulge(z, y);
  // rear opening edge (skin is cut away around the wheel)
  const archYAt = (z) => {
    if (z > rearOpen[0][0]) return -1;
    if (z < rearOpen[rearOpen.length - 1][0]) return rearOpen[rearOpen.length - 1][1];   // behind the arch: tub ends at the rear corner
    for (let i = 0; i < rearOpen.length - 1; i++) {
      const [z0, y0] = rearOpen[i], [z1, y1] = rearOpen[i + 1];
      if (z <= z0 && z >= z1) return y0 + (y1 - y0) * ((z - z0) / (z1 - z0));
    }
    return -1;
  };
  {
    const nz = 90 + 40 * QS.detail, ny = 18 + 8 * QS.detail;
    for (const s2 of sides) {
      const pos = [], idx = [], keep = [];
      for (let j = 0; j <= ny; j++) {
        const y = skinY0 + (skinY1 - skinY0) * (j / ny);
        for (let i = 0; i <= nz; i++) {
          const z = skinZ0 + (skinZ1 - skinZ0) * (i / nz);
          pos.push(s2 * surfX(z, y), y, z);
          keep.push(y > archYAt(z) + 0.004);
        }
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nz; i++) {
        const a0 = j * (nz + 1) + i, b0 = a0 + 1, c0 = a0 + nz + 1, d0 = c0 + 1;
        if (!(keep[a0] && keep[b0] && keep[c0] && keep[d0])) continue;
        if (s2 > 0) idx.push(a0, c0, b0, b0, c0, d0); else idx.push(a0, b0, c0, b0, d0, c0);   // outward-facing
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      B.add('paint', g);
    }
  }
  {
    for (const s2 of sides) {
      // door shut lines follow the curved skin (vertical) and run along the bottom edge
      for (const z of [0.272, -0.112, -0.37]) {
        const pts = [];
        const yTop = yBelt - 0.006, yLow = Math.max(yBot + 0.008, archYAt(z) + 0.006);
        for (let k = 0; k <= 12; k++) { const y = yLow + (yTop - yLow) * (k / 12); pts.push(V(s2 * (surfX(z, y) + 0.0004), y, z)); }
        B.add('trim', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0016, 5, false));
      }
      B.add('trim', box(0.003, 0.003, 0.64), M(s2 * (xBody + 0.0012), yBot + 0.012, -0.05));
      // JL pull handles near the rear edge of each door, just above the character line: dark recess + black bar
      const hy = 0.207;
      for (const [hz, lock] of [[-0.045, true], [-0.315, false]]) {
        const xs = surfX(hz, hy);
        B.add('trim', rbox(0.004, 0.02, 0.054, 0.006), M(s2 * (xs - 0.0012), hy, hz));
        B.add('black', rbox(0.008, 0.011, 0.06, 0.004), M(s2 * (xs + 0.002), hy + 0.002, hz));
        if (lock) B.add('chrome', cylX(0.003, 0.004, 10), M(s2 * (xs + 0.006), hy + 0.002, hz + 0.022));
      }
      // exposed JL hinges on the front edge of both doors: leaf across the shut line, pin barrel, bolt heads
      for (const [zs, hys] of [[0.272, [0.2, 0.05]], [-0.112, [0.168, 0.05]]]) {
        for (const hy2 of hys) {
          const xs = surfX(zs, hy2);
          B.add('black', rbox(0.006, 0.028, 0.038, 0.004), M(s2 * (xs + 0.0025), hy2, zs - 0.006));
          B.add('black', cyl(0.0042, 0.034, 10), M(s2 * (xs + 0.0045), hy2, zs + 0.012));
          for (const bz of [-0.018, 0.0]) B.add('bolt', cylX(0.0022, 0.002, 6), M(s2 * (xs + 0.0058), hy2, zs - 0.006 + bz));
        }
      }
      // hardtop-to-tub seal along the belt line
      B.add('trim', box(0.008, 0.004, zFenderRear - zBack - 0.03), M(s2 * 0.288, yBelt + 0.001, (zFenderRear + zBack) / 2));
      // red rear side marker on the back of the rear flare
      B.add('tailLens', rbox(0.004, 0.012, 0.026, 0.003), M(s2 * 0.367, 0.085, -0.738));
      // fuel door (driver side): rounded square cover ringed by a dark shut line
      if (s2 > 0) {
        const fz = -0.585, fy = 0.2, xs = surfX(fz, fy);
        B.add('trim', rbox(0.003, 0.04, 0.04, 0.009), M(xs - 0.0004, fy, fz));
        B.add('paint', rbox(0.0035, 0.036, 0.036, 0.008), M(xs + 0.0002, fy, fz));
      }
      // small square door badge, tilted to the local surface
      const by = 0.19, bz = 0.2, dy = 0.004;
      const tiltB = Math.atan2(surfX(bz, by + dy) - surfX(bz, by - dy), 2 * dy);
      B.add('decalBadge', new THREE.PlaneGeometry(0.035, 0.035).rotateY(s2 * PI / 2), M(s2 * (surfX(bz, by) + 0.0008), by, bz, 0, 0, s2 * tiltB));
    }
  }

  // ------------------------------------------------------- Decals -----------
  for (const s2 of sides) {
    const g = new THREE.PlaneGeometry(0.17, 0.027);
    g.rotateY(s2 * PI / 2);
    B.add('decalHood', g, M(s2 * 0.3352, 0.214, 0.52));
  }

  // --------------------------------------------- Tail lights + spare ---------
  // JL lamps: tall black housings at the rear corners, a red LED loop around a smoked centre,
  // clear reverse lens in the bottom section
  const tlX = 0.247, tlY = 0.122, tlW = 0.042, tlH = 0.11, zR = zBack - 0.001;
  for (const s2 of sides) {
    const x = s2 * tlX;
    B.add('black', rbox(tlW, tlH, 0.012, 0.006), M(x, tlY, zR - 0.004));
    const ly0 = tlY - tlH / 2 + 0.03, ly1 = tlY + tlH / 2 - 0.006, lw = tlW - 0.01;   // red section
    B.add('trim', rbox(lw - 0.004, ly1 - ly0 - 0.004, 0.004, 0.003), M(x, (ly0 + ly1) / 2, zR - 0.0095));
    B.add('tailLens', rbox(lw, 0.0045, 0.004, 0.002), M(x, ly1 - 0.002, zR - 0.011));
    B.add('tailLens', rbox(lw, 0.0045, 0.004, 0.002), M(x, ly0 + 0.002, zR - 0.011));
    for (const e of [-1, 1]) B.add('tailLens', rbox(0.0045, ly1 - ly0, 0.004, 0.002), M(x + e * (lw / 2 - 0.002), (ly0 + ly1) / 2, zR - 0.011));
    B.add('tailLens', rbox(0.006, ly1 - ly0 - 0.018, 0.003, 0.002), M(x + s2 * 0.004, (ly0 + ly1) / 2, zR - 0.0105));   // inner LED bar
    // reverse lamp: chrome reflector under a clear lens
    const ry = tlY - tlH / 2 + 0.015;
    B.add('chrome', rbox(lw, 0.018, 0.003, 0.003), M(x, ry, zR - 0.009));
    B.add('lensClear', rbox(lw + 0.002, 0.02, 0.004, 0.003), M(x, ry, zR - 0.012));
  }
  // tailgate: shut lines just inside the lamps and along the bottom edge, hinges on the right (-X), handle on the left
  for (const s2 of sides) B.add('trim', box(0.0016, yBelt - yBot - 0.03, 0.0015), M(s2 * 0.222, (yBelt + yBot) / 2 + 0.008, zBack - 0.0004));
  B.add('trim', box(0.444, 0.0016, 0.0015), M(0, yBot + 0.024, zBack - 0.0004));
  for (const y of [0.04, 0.2]) {
    B.add('black', rbox(0.03, 0.024, 0.008, 0.003), M(-0.222, y, zBack - 0.004));
    B.add('black', cyl(0.004, 0.026, 8), M(-0.222, y, zBack - 0.009));
  }
  B.add('black', rbox(0.034, 0.012, 0.008, 0.004), M(0.196, 0.214, zBack - 0.004));     // tailgate handle
  // spare carrier: plate + hub mount, and the third brake light on a stalk above the tyre
  B.add('steel', rbox(0.14, 0.11, 0.01, 0.006), M(0, 0.19, zBack - 0.008));
  B.add('steel', cylZ(0.024, 0.04), M(0, 0.19, zBack - 0.03));
  B.add('steel', rbox(0.018, 0.23, 0.01, 0.004), M(0, 0.285, zBack - 0.092));
  B.add('steel', rbox(0.016, 0.012, 0.09, 0.004), M(0, 0.16, zBack - 0.05));
  B.add('black', rbox(0.1, 0.022, 0.016, 0.006), M(0, 0.4, zBack - 0.094));
  B.add('brakeLens', rbox(0.088, 0.011, 0.004, 0.003), M(0, 0.4, zBack - 0.103));

  // ------------------------------------------------- Front bumper -----------
  {
    // stubby plate bumper, narrower than the grille, ends angled back
    B.add('steel', rbox(0.36, 0.056, 0.05, 0.007), M(0, 0.05, 0.768));
    for (const s2 of sides) B.add('steel', rbox(0.06, 0.05, 0.045, 0.007), M(s2 * 0.198, 0.051, 0.753, 0, s2 * 0.55, 0));
    // two recessed round holes + centre emblem on the bumper face
    for (const s2 of sides) {
      B.add('trim', cylZ(0.0125, 0.006, QS.cylSeg), M(s2 * 0.05, 0.052, 0.7925));
      B.add('steel', torus(0.0135, 0.0025, 6, QS.cylSeg), M(s2 * 0.05, 0.052, 0.794));
    }
    B.add('steel', rbox(0.02, 0.026, 0.006, 0.004), M(0, 0.052, 0.794));
    // narrow upright hoop: risers from the bumper top, top bar at slot mid-height, leaning forward
    const hoop = new THREE.CatmullRomCurve3([
      V(-0.13, 0.076, 0.781), V(-0.112, 0.13, 0.795), V(-0.095, 0.17, 0.805), V(-0.078, 0.182, 0.808), V(0, 0.184, 0.81),
      V(0.078, 0.182, 0.808), V(0.095, 0.17, 0.805), V(0.112, 0.13, 0.795), V(0.13, 0.076, 0.781)], false, 'centripetal');
    B.add('steel', new THREE.TubeGeometry(hoop, 36, 0.0088, 10, false));
    for (const s2 of sides) B.add('steel', rbox(0.026, 0.01, 0.024, 0.003), M(s2 * 0.13, 0.078, 0.781));
    // angled lower skid with a row of slots
    B.add('steel', box(0.3, 0.008, 0.05), M(0, 0.012, 0.762, 0.55));
    for (let i = 0; i < 5; i++) B.add('trim', rbox(0.022, 0.008, 0.004, 0.003), M(-0.08 + i * 0.04, 0.012, 0.783, 0.55));
  }

  // -------------------------------------------------- Rear bumper -----------
  {
    // stubby steel bumper tucked under the tub's rear edge (as in the side photo): faceted main bar with a
    // chamfered lower rear edge, angular end caps flush with the body sides whose front edge slants back
    // under the flare, welded seams, step grip slots, bolt recesses, D-ring tabs and a short hitch receiver
    const bTop = 0.058, bBot = -0.006, bRear = zBack - 0.016;
    const barProf = (zFrontTop, zFrontBot) => polyShape([
      [zFrontTop, bTop], [zFrontBot, bBot], [zBack - 0.002, bBot], [bRear, 0.012], [bRear, 0.05], [zBack - 0.01, bTop],
    ]);
    B.add('steel', extrudeX(barProf(zBack + 0.03, zBack + 0.03), -0.25, 0.25, 0.003, 2));
    for (const s2 of sides) {
      const cap = barProf(zBack + 0.056, zBack + 0.03);
      B.add('steel', s2 > 0 ? extrudeX(cap, 0.25, 0.292, 0.004, 2) : extrudeX(cap, -0.292, -0.25, 0.004, 2));
      B.add('trim', box(0.0015, 0.05, 0.0015), M(s2 * 0.25, 0.03, bRear - 0.0004));                  // weld seam, rear face
      B.add('trim', box(0.0015, 0.0012, 0.04), M(s2 * 0.25, bTop + 0.0004, zBack + 0.008));            // weld seam, top
      for (let i = 0; i < 4; i++) B.add('trim', rbox(0.016, 0.0016, 0.024, 0.0008), M(s2 * (0.09 + i * 0.03), bTop + 0.0004, zBack + 0.008));   // step grip slots
      for (const bx of [0.06, 0.2]) {
        B.add('trim', cylZ(0.0065, 0.003, 12), M(s2 * bx, 0.036, bRear - 0.0008));                     // bolt recesses
        B.add('bolt', cylZ(0.0035, 0.003, 6), M(s2 * bx, 0.036, bRear - 0.0016));
      }
      // D-ring tab under the bar + shackle
      B.add('steel', rbox(0.01, 0.022, 0.024, 0.003), M(s2 * 0.14, bBot - 0.008, zBack + 0.004));
      B.add('steel', torus(0.009, 0.0026, 6, 14), M(s2 * 0.14, bBot - 0.02, zBack + 0.004, 0, PI / 2, 0));
    }
    B.add('steel', box(0.4, 0.004, 0.003), M(0, 0.045, bRear - 0.0012));                // pressed rib across the face
    // short hitch receiver under the centre, clear of the spare
    B.add('steel', box(0.026, 0.026, 0.04), M(0, -0.018, zBack - 0.02));
    B.add('trim', box(0.018, 0.018, 0.003), M(0, -0.018, zBack - 0.0405));
    B.add('bolt', cylX(0.0032, 0.032, 8), M(0, -0.018, zBack - 0.03));
  }

  // -------------------------------------------------- Rock sliders ----------
  for (const s2 of sides) {
    const tube = new THREE.CatmullRomCurve3([V(s2 * 0.285, -0.045, 0.27), V(s2 * 0.31, -0.05, 0.22), V(s2 * 0.315, -0.05, -0.25), V(s2 * 0.29, -0.045, -0.3)]);
    B.add('steel', new THREE.TubeGeometry(tube, 24, 0.011, 10, false));
    B.add('steel', rbox(0.04, 0.006, 0.5, 0.002), M(s2 * 0.3, -0.036, -0.02));
    for (const z of [0.16, -0.2]) B.add('frame', rodGeo(V(s2 * 0.115, -0.07, z), V(s2 * 0.305, -0.05, z), 0.007));
  }

  // ------------------------------------------- Roof rack + gear -------------
  // Matches the SCX30 JLU photos: low black tray, tall ribbed crate over the rear half, two orange traction
  // boards up front, light-bar fairing above the windshield, Hi-Lift jack + tool panel on the left side.
  {
    const y0 = yRoof + 0.02, zf = 0.11, zb = zBack + 0.012, xw = 0.27;
    const L = zf - zb, zc = (zf + zb) / 2;
    // tray: perimeter rails, cross slats, feet on the roof
    // moulded side rails with real section (rounded box), front/rear crossbars, slats
    for (const sx2 of sides) B.add('steel', rbox(0.022, 0.024, L, 0.008), M(sx2 * (xw + 0.004), y0 + 0.002, zc));
    for (const z of [zf, zb]) B.add('steel', rbox(2 * xw + 0.03, 0.02, 0.018, 0.006), M(0, y0, z));
    for (let i = 1; i < 10; i++) B.add('steel', rbox(2 * xw, 0.006, 0.018, 0.002), M(0, y0 - 0.002, zf - (i / 10) * L));
    // raised outer lip: a rounded rail standing off the side rail, bulging outward over the rear windows,
    // tied back to the rail by short moulded brackets
    for (const sx2 of sides) {
      const lipX = (z) => 0.294 + 0.008 * Math.exp(-(((z + 0.42) / 0.2) ** 2));
      const lipPts = [];
      for (let k = 0; k <= 14; k++) { const z = zf - 0.01 - (k / 14) * (L - 0.02); lipPts.push(V(sx2 * lipX(z), y0 + 0.008, z)); }
      B.add('steel', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lipPts), 56, 0.0075, 10, false));
      for (const z of [zf - 0.01, zb + 0.01]) B.add('steel', sphere(0.0075, 10, 6), M(sx2 * lipX(z), y0 + 0.008, z));   // capped ends
      for (let k = 0; k <= 6; k++) {
        const z = zf - 0.03 - (k / 6) * (L - 0.06), xo = lipX(z);
        B.add('steel', rbox(xo - xw - 0.004, 0.01, 0.012, 0.003), M(sx2 * (xw + xo + 0.004) / 2, y0 + 0.006, z));
      }
    }
    // L-shaped mounting feet: rubber pad on the roof, upright leg, bolt head
    for (const z of [0.07, -0.3, -0.68]) for (const sx2 of sides) {
      B.add('trim', rbox(0.034, 0.003, 0.044, 0.0015), M(sx2 * (xw - 0.006), yRoof + 0.0015, z));
      B.add('steel', rbox(0.026, 0.004, 0.036, 0.0015), M(sx2 * (xw - 0.006), yRoof + 0.005, z));
      B.add('steel', rbox(0.01, y0 - yRoof - 0.006, 0.03, 0.003), M(sx2 * (xw + 0.002), (y0 + yRoof) / 2 + 0.001, z));
      B.add('bolt', cylX(0.0035, 0.004, 6), M(sx2 * (xw + 0.008), (y0 + yRoof) / 2, z));
    }

    // tall crate over the rear half: ribbed walls, two cases inside
    const zc0 = -0.17, zc1 = zb, ch = 0.062, cl = zc0 - zc1;
    for (const sx2 of sides) B.add('black', rbox(0.018, ch, cl, 0.006), M(sx2 * (xw - 0.004), y0 + ch / 2, (zc0 + zc1) / 2));
    for (const z of [zc0, zc1]) B.add('black', rbox(2 * xw - 0.004, ch, 0.018, 0.006), M(0, y0 + ch / 2, z));
    const ribs = 3 + 3 * Math.min(2, QS.detail);
    for (let i = 0; i <= ribs; i++) {
      const z = zc0 - (i / ribs) * cl;
      for (const sx2 of sides) B.add('steel', rbox(0.01, ch - 0.012, 0.009, 0.003), M(sx2 * (xw + 0.008), y0 + ch / 2 - 0.002, z));
    }
    // rolled top lip overhanging the walls, and a lower flange where the crate meets the tray
    for (const sx2 of sides) {
      B.add('steel', rbox(0.026, 0.01, cl + 0.01, 0.0045), M(sx2 * (xw + 0.002), y0 + ch - 0.002, (zc0 + zc1) / 2));
      B.add('steel', rbox(0.022, 0.006, cl, 0.002), M(sx2 * (xw + 0.004), y0 + 0.014, (zc0 + zc1) / 2));
    }
    for (const z of [zc0, zc1]) B.add('steel', rbox(2 * xw + 0.02, 0.01, 0.024, 0.0045), M(0, y0 + ch - 0.002, z));
    // two hard cases: body + lid split line, moulded lid ribs, corner bumpers, latches and fold-down handles
    const czc = (zc0 + zc1) / 2, cLen = cl - 0.04, yLid = y0 + 0.053;
    for (const sx2 of sides) {
      const x = sx2 * 0.125;
      B.add('black', rbox(0.215, 0.05, cLen, 0.01), M(x, y0 + 0.028, czc));
      B.add('trim', box(0.217, 0.004, cLen + 0.002), M(x, y0 + 0.04, czc));
      // lid: raised perimeter rim, three longitudinal ribs, cross ribs
      B.add('black', rbox(0.19, 0.004, cLen - 0.03, 0.003), M(x, yLid + 0.001, czc));
      if (D >= 1) {
        for (const rx of [-0.06, 0, 0.06]) B.add('black', rbox(0.008, 0.004, cLen - 0.07, 0.002), M(x + rx, yLid + 0.004, czc));
        for (const rz of [-0.33, 0, 0.33]) B.add('black', rbox(0.17, 0.004, 0.008, 0.002), M(x, yLid + 0.004, czc + rz * (cLen - 0.08)));
      }
      // corner bumpers
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) B.add('steel', rbox(0.022, 0.052, 0.022, 0.006), M(x + ex * 0.0985, y0 + 0.028, czc + ez * (cLen / 2 - 0.0085)));
      // fold-down carry handles (front + rear of the lid)
      for (const z of [zc0 - 0.04, zc1 + 0.04]) {
        B.add('trim', rbox(0.05, 0.002, 0.016, 0.004), M(x, yLid + 0.0035, z));
        B.add('steel', rbox(0.044, 0.006, 0.006, 0.003), M(x, yLid + 0.005, z));
      }
      // two latches on the inboard side
      for (const lz of [-0.12, 0.12]) B.add('steel', rbox(0.006, 0.02, 0.026, 0.002), M(x - sx2 * 0.109, y0 + 0.04, czc + lz));
    }
    // cargo straps over both cases and down the crate walls, cam buckles on top
    for (const sz of [czc + cl * 0.3, czc - cl * 0.3]) {
      B.add('canvas', box(2 * xw - 0.02, 0.003, 0.02), M(0, yLid + 0.0065, sz));
      for (const sx2 of sides) B.add('canvas', box(0.003, ch - 0.004, 0.02), M(sx2 * (xw + 0.0105), y0 + ch / 2, sz));
      for (const sx2 of sides) B.add('canvas', box(0.024, 0.003, 0.02), M(sx2 * (xw - 0.002), y0 + ch + 0.001, sz));
      B.add('toolMetal', rbox(0.03, 0.007, 0.026, 0.003), M(-0.06, yLid + 0.009, sz));
    }

    // two orange traction boards side by side on the front half, held by black pins
    const zt0 = zf - 0.02, zt1 = zc0 + 0.01, tl = zt0 - zt1;
    for (const sx2 of sides) {
      const x = sx2 * 0.125;
      // boards stand off the tray on four posts (visible gap + contact shadow underneath)
      const by = y0 + 0.006, bzc = (zt0 + zt1) / 2;
      B.add('trim', rbox(0.206, 0.0015, tl + 0.006, 0.003), M(x, y0 + 0.0012, bzc));                  // ambient-occlusion pad
      for (const ex of [-0.07, 0.07]) for (const ez of [-1, 1]) B.add('black', cyl(0.0055, 0.012, 10), M(x + ex, y0 + 0.006, bzc + ez * (tl / 2 - 0.04)));
      B.add('red', rbox(0.2, 0.012, tl, 0.006), M(x, by + 0.014, bzc));
      if (D >= 1) {
        const nx = 5, nz = Math.max(4, Math.round(tl / 0.035));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
          B.add('red', box(0.014, 0.007, 0.014), M(x - 0.072 + i * 0.036, by + 0.022, zt1 + 0.02 + j * (tl - 0.04) / (nz - 1), 0, 0.785, 0));
        }
      }
      // mounting pins through the boards: black stem + wide knurled cap
      for (const z of [zt0 - 0.03, zt1 + 0.03]) {
        B.add('black', cyl(0.006, 0.03, 10), M(x, by + 0.018, z));
        B.add('black', cyl(0.012, 0.007, 14, 0.0105), M(x, by + 0.034, z));
      }
      // raised side rails with moulded handle slots along both long edges
      for (const ex of [-1, 1]) {
        B.add('red', rbox(0.012, 0.008, tl - 0.006, 0.0035), M(x + ex * 0.094, by + 0.022, bzc));
        if (D >= 1) for (const f of [0.22, 0.5, 0.78]) B.add('trim', rbox(0.006, 0.0015, 0.03, 0.002), M(x + ex * 0.094, by + 0.0262, zt1 + f * tl));
      }
    }

    // light-bar fairing: black panel sloping from the rack front down over the windshield header,
    // 8 round pods hung along its lower edge, carried on brackets from the A-pillars
    const fz0 = zf, fy0 = y0 + 0.012, fz1 = 0.175, fy1 = yWinTop + 0.03;
    const fLen = Math.hypot(fz1 - fz0, fy1 - fy0), fAng = Math.atan2(fy0 - fy1, fz1 - fz0);
    B.add('black', rbox(0.5, 0.008, fLen, 0.004), M(0, (fy0 + fy1) / 2, (fz0 + fz1) / 2, fAng));
    B.add('black', rbox(0.52, 0.04, 0.012, 0.004), M(0, fy1 + 0.008, fz1 + 0.002));
    for (const sx2 of sides) B.add('black', rodGeo(V(sx2 * 0.27, yWinTop - 0.01, 0.15), V(sx2 * 0.245, fy1, fz1 - 0.005), 0.005));
    // 8 large round pods nearly touching, spanning the windshield width (as in the front photo)
    const podR = 0.0285, podSeg = QS.cylSeg + 8;
    for (let i = 0; i < 8; i++) {
      const x = -0.21 + i * 0.06, y = fy1 - 0.01, z = fz1 + 0.02;
      B.add('black', cylZ(podR, 0.026, podSeg, podR * 0.85), M(x, y, z - 0.004));          // deep barrel housing
      B.add('black', rbox(0.016, 0.022, 0.014, 0.004), M(x, y + podR + 0.004, z - 0.01));  // mount to the fairing
      B.add('black', torus(podR - 0.002, 0.0042, 8, podSeg), M(x, y, z + 0.009));          // thick black bezel
      B.add('barLens', cylZ(podR - 0.0055, 0.003, podSeg), M(x, y, z + 0.008));            // lens
      B.add('chrome', torus(podR * 0.62, 0.0018, 6, podSeg), M(x, y, z + 0.0095));        // reflector ring
      B.add('chrome', cylZ(podR * 0.25, 0.003, 12), M(x, y, z + 0.0098));                  // LED emitter
    }

    // Hi-Lift jack along the left rack edge: orange bar + rail, handle angled up at the rear
    const jx = xw + 0.052, jy = y0 - 0.002;
    // standing bar (I-section look: web + flanges) with a row of climbing holes
    B.add('red', rbox(0.008, 0.024, 0.62, 0.002), M(jx, jy, -0.4));
    for (const fy of [-0.011, 0.011]) B.add('red', rbox(0.016, 0.004, 0.62, 0.0015), M(jx, jy + fy, -0.4));
    if (D >= 1) for (let i = 0; i < 16; i++) B.add('trim', cylX(0.0028, 0.0095, 8), M(jx, jy, -0.13 - i * 0.034));
    // top clamp + foot plate at the ends
    B.add('red', rbox(0.022, 0.03, 0.02, 0.004), M(jx, jy + 0.002, -0.095));
    B.add('red', rbox(0.03, 0.008, 0.05, 0.003), M(jx, jy - 0.012, -0.705));
    // lifting mechanism + handle socket near the rear, handle angled up and back
    B.add('red', rbox(0.024, 0.05, 0.034, 0.005), M(jx + 0.002, jy + 0.014, -0.64));
    B.add('bolt', cylX(0.003, 0.03, 8), M(jx + 0.002, jy + 0.03, -0.64));
    B.add('red', rodGeo(V(jx + 0.002, jy + 0.03, -0.63), V(jx + 0.008, jy + 0.085, -0.735), 0.0065));
    B.add('black', cyl(0.0085, 0.03, 10), M(jx + 0.0078, jy + 0.08, -0.728, -0.9));            // rubber grip
    // clamp brackets: arm from the lip out to a U-clamp wrapped round the bar, with bolts
    for (const z of [-0.2, -0.56]) {
      B.add('steel', rbox(jx - 0.29, 0.008, 0.016, 0.003), M((jx + 0.29) / 2, jy - 0.004, z));
      B.add('steel', rbox(0.026, 0.034, 0.014, 0.004), M(jx, jy, z));
      B.add('bolt', cylX(0.0032, 0.03, 6), M(jx, jy + 0.012, z));
    }

    // tool panel on the left rear quarter: black recovery boards, grey shovel above, grey pry bar below
    const px = xBody + 0.014;
    // contact shadow on the body behind the panel, four standoff brackets, panel with a raised moulded rim
    B.add('trim', rbox(0.002, 0.14, 0.29, 0.01), M(xBody - 0.0075, 0.335, -0.6));
    for (const by2 of [0.29, 0.38]) for (const bz of [-0.49, -0.71]) {
      B.add('steel', rbox(0.016, 0.014, 0.016, 0.004), M(xBody + 0.0, by2, bz));
      B.add('bolt', cylX(0.0032, 0.003, 6), M(px + 0.0085, by2, bz));
    }
    B.add('black', rbox(0.012, 0.125, 0.27, 0.005), M(px, 0.335, -0.6));
    for (const ey of [-1, 1]) B.add('black', rbox(0.006, 0.008, 0.27, 0.003), M(px + 0.007, 0.335 + ey * 0.0585, -0.6));
    for (const ez of [-1, 1]) B.add('black', rbox(0.006, 0.125, 0.008, 0.003), M(px + 0.007, 0.335, -0.6 + ez * 0.131));
    if (D >= 1) for (let i = 0; i < 4; i++) B.add('black', rbox(0.006, 0.1, 0.012, 0.002), M(px + 0.008, 0.335, -0.5 - i * 0.065));
    const tx = px + 0.016;
    // shovel: pointed spade blade (front), tapered collar, shaft, D-handle with rubber grip (rear)
    const sy = 0.372;
    {
      const zs = -0.462, zt = -0.388, hw = 0.026;           // blade shoulder z, tip z, half width
      const bl = new THREE.Shape();
      bl.moveTo(zs, sy - hw * 0.82);
      bl.quadraticCurveTo(zs + 0.004, sy - hw, zs + 0.012, sy - hw);         // rolled shoulder
      bl.bezierCurveTo(zs + 0.05, sy - hw * 1.02, zt - 0.006, sy - hw * 0.45, zt, sy);   // curved side to the tip
      bl.bezierCurveTo(zt - 0.006, sy + hw * 0.45, zs + 0.05, sy + hw * 1.02, zs + 0.012, sy + hw);
      bl.quadraticCurveTo(zs + 0.004, sy + hw, zs, sy + hw * 0.82);
      bl.lineTo(zs, sy - hw * 0.82);
      B.add('toolMetal', extrudeX(bl, tx - 0.002, tx + 0.002, 0.0008, 1, 16));
      // pressed centre rib + step where the blade meets the socket
      B.add('toolMetal', cylZ(0.0035, 0.06, 8, 0.0015), M(tx + 0.0025, sy, zs + 0.03, 0, 0, 0, 0.6, 1, 1));
      B.add('toolMetal', rbox(0.006, 0.03, 0.01, 0.003), M(tx + 0.001, sy, zs - 0.003));
      // tapered socket (collar) up to the shaft, with a rivet
      B.add('toolMetal', cylZ(0.0058, 0.034, 10, 0.0095), M(tx, sy, zs - 0.024));
      B.add('bolt', cylX(0.0022, 0.013, 6), M(tx, sy, zs - 0.03));
    }
    // shaft
    B.add('toolMetal', cylZ(0.0046, 0.19, 10), M(tx, sy, -0.592));
    // D-handle: two flared arms from a collar, crossbar wrapped in a black rubber grip
    {
      const zc = -0.688, zg = -0.733, gw = 0.019;
      B.add('toolMetal', cylZ(0.0062, 0.012, 10), M(tx, sy, zc));
      for (const sd of [1, -1]) {
        const arm = new THREE.CatmullRomCurve3([V(tx, sy, zc - 0.004), V(tx, sy + sd * 0.008, zc - 0.018), V(tx, sy + sd * gw, zg + 0.008), V(tx, sy + sd * gw, zg)]);
        B.add('toolMetal', new THREE.TubeGeometry(arm, 10, 0.0032, 8, false));
      }
      B.add('toolMetal', cyl(0.0032, gw * 2 + 0.004, 8), M(tx, sy, zg));
      B.add('black', cyl(0.0052, gw * 2 - 0.006, 10), M(tx, sy, zg));
    }
    // pry bar: chisel tip at the front, hex shaft, curved claw at the rear
    {
      const py = 0.3;
      B.add('toolMetal', cylZ(0.0046, 0.24, 6), M(tx, py, -0.585));
      B.add('toolMetal', cylZ(0.0046, 0.03, 6, 0.0015), M(tx, py, -0.45, 0, 0, 0, 1, 0.45, 1));   // flattened chisel
      // curved claw continuing from the shaft end, bending up and back toward the front
      const claw = new THREE.CatmullRomCurve3([V(tx, py, -0.703), V(tx, py + 0.002, -0.722), V(tx, py + 0.014, -0.734),
        V(tx, py + 0.029, -0.73), V(tx, py + 0.036, -0.716)]);
      B.add('toolMetal', new THREE.TubeGeometry(claw, 14, 0.0042, 8, false));
    }
    // rubber strap mounts: a block on the panel under each tool, and a strap looped over the tool
    for (const z of [-0.52, -0.66]) for (const [ty, tr] of [[0.372, 0.0046], [0.3, 0.0046]]) {
      B.add('black', rbox(0.01, 0.018, 0.012, 0.003), M(px + 0.011, ty, z));
      B.add('linkBlack', torus(tr + 0.0028, 0.0022, 6, 14), M(tx, ty, z));
    }

    // A-pillar ditch lights
    if (D >= 2) for (const sx2 of sides) {
      B.add('black', rbox(0.026, 0.022, 0.02, 0.005), M(sx2 * 0.29, yWinTop - 0.03, 0.17));
      B.add('barLens', box(0.02, 0.016, 0.003), M(sx2 * 0.29, yWinTop - 0.03, 0.181));
    }
  }

  // ------------------------------------------------------- Interior ---------
  // JL cabin: carpeted floor, shaped dash with binnacle/screen/vents, steering wheel (left-hand drive = +X),
  // bolstered front buckets, console, rear bench, door cards and the padded sport bar.
  if (QS.interior) {
    const yF = yBelt - 0.006;                          // cabin floor (interior tub)
    const tube = (pts, r = 0.0075, key = 'intTrim') => B.add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 8, false));
    B.add('interior', box(0.55, 0.004, 0.93), M(0, yF, -0.27));
    // ---- dashboard
    B.add('intTrim', rbox(0.54, 0.05, 0.07, 0.014, 3), M(0, yBelt + 0.03, 0.205));
    B.add('interior', rbox(0.52, 0.012, 0.06, 0.005), M(0, yBelt + 0.057, 0.215, -0.25));          // soft top pad
    B.add('intTrim', rbox(0.11, 0.026, 0.045, 0.01, 3), M(0.13, yBelt + 0.064, 0.196));          // binnacle hood
    for (const gx of [0.108, 0.152]) {
      B.add('chrome', torus(0.0115, 0.0016, 6, 16), M(gx, yBelt + 0.05, 0.172, -0.25));
      B.add('glassLens', cylZ(0.0105, 0.002, 16), M(gx, yBelt + 0.05, 0.173, -0.25));
    }
    B.add('glassLens', rbox(0.075, 0.042, 0.004, 0.003), M(0, yBelt + 0.055, 0.172, -0.3));      // centre screen
    B.add('intTrim', rbox(0.085, 0.052, 0.006, 0.004), M(0, yBelt + 0.055, 0.174, -0.3));
    for (const vx of [-0.22, -0.045, 0.045, 0.225]) {
      B.add('chrome', torus(0.008, 0.0016, 6, 14), M(vx, yBelt + 0.03, 0.17));
      B.add('trim', cylZ(0.0075, 0.002, 12), M(vx, yBelt + 0.03, 0.1705));
    }
    tube([V(-0.2, yBelt + 0.062, 0.18), V(-0.16, yBelt + 0.074, 0.172), V(-0.12, yBelt + 0.062, 0.18)], 0.0035);  // grab handle
    // ---- steering wheel + column (driver on the left, +X)
    const sw = V(0.13, yBelt + 0.078, 0.15), tilt = 0.5;    // top of the rim leans forward, toward the dash
    B.add('intTrim', torus(0.032, 0.0055, 8, 24), M(sw.x, sw.y, sw.z, tilt, 0, 0));
    for (const a2 of [0, PI * 0.72, -PI * 0.72]) {
      const sp = box(0.026, 0.006, 0.004); sp.translate(0.016, 0, 0); sp.rotateZ(a2 - PI / 2);
      B.add('intTrim', sp, M(sw.x, sw.y, sw.z, tilt, 0, 0));
    }
    B.add('intTrim', cylZ(0.011, 0.01, 14), M(sw.x, sw.y, sw.z, tilt, 0, 0));      // hub
    B.add('intTrim', rodGeo(V(sw.x, sw.y - 0.004, sw.z + 0.008), V(sw.x, yBelt + 0.045, 0.2), 0.0055));
    // ---- front bucket seats
    for (const s2 of sides) {
      const x = s2 * 0.13;
      B.add('seat', rbox(0.12, 0.03, 0.12, 0.012, 3), M(x, yF + 0.028, -0.025));                 // cushion
      for (const bx of [-1, 1]) B.add('seat', rbox(0.016, 0.022, 0.11, 0.007), M(x + bx * 0.055, yF + 0.046, -0.025));   // bolsters
      B.add('seat', rbox(0.12, 0.13, 0.028, 0.012, 3), M(x, yF + 0.11, -0.095, -0.17));          // backrest
      for (const bx of [-1, 1]) B.add('seat', rbox(0.016, 0.11, 0.02, 0.007), M(x + bx * 0.056, yF + 0.11, -0.088, -0.17));
      B.add('seat', rbox(0.07, 0.04, 0.022, 0.01, 3), M(x, yF + 0.2, -0.113, -0.12));            // headrest
      for (const hx of [-0.02, 0.02]) B.add('chrome', cyl(0.0022, 0.02, 6), M(x + hx, yF + 0.177, -0.11, -0.15));
      // red Rubicon stitching
      B.add('red', box(0.002, 0.11, 0.002), M(x - 0.04, yF + 0.11, -0.08, -0.17));
      B.add('red', box(0.002, 0.11, 0.002), M(x + 0.04, yF + 0.11, -0.08, -0.17));
      B.add('red', box(0.08, 0.002, 0.002), M(x, yF + 0.044, 0.034));
    }
    // ---- centre console with shifter + cup holders
    B.add('intTrim', rbox(0.07, 0.04, 0.22, 0.01, 3), M(0, yF + 0.02, 0.05));
    B.add('intTrim', rodGeo(V(0, yF + 0.04, 0.09), V(0, yF + 0.07, 0.08), 0.003));
    B.add('chrome', sphere(0.007, 12, 8), M(0, yF + 0.073, 0.079));
    for (const cz of [0.02, -0.01]) B.add('trim', cyl(0.008, 0.004, 12), M(0, yF + 0.04, cz));
    // ---- rear bench (3 seats)
    B.add('seat', rbox(0.48, 0.03, 0.12, 0.012, 3), M(0, yF + 0.025, -0.37));
    B.add('seat', rbox(0.48, 0.12, 0.026, 0.012, 3), M(0, yF + 0.1, -0.44, -0.15));
    for (const hx of [-0.16, 0, 0.16]) B.add('seat', rbox(0.06, 0.034, 0.02, 0.009, 3), M(hx, yF + 0.18, -0.455, -0.1));
    for (const sx2 of [-0.08, 0.08]) B.add('red', box(0.002, 0.1, 0.002), M(sx2, yF + 0.1, -0.425, -0.15));
    // ---- door cards with armrests and handles
    for (const s2 of sides) {
      const x = s2 * 0.276;
      for (const [z0, z1] of [[0.12, -0.08], [-0.12, -0.34]]) {
        B.add('intTrim', box(0.006, 0.045, z0 - z1), M(x, yF + 0.022, (z0 + z1) / 2));
        B.add('interior', rbox(0.018, 0.012, (z0 - z1) * 0.6, 0.004), M(x - s2 * 0.008, yF + 0.04, (z0 + z1) / 2 - 0.01));
        B.add('chrome', box(0.003, 0.006, 0.022), M(x - s2 * 0.004, yF + 0.056, z0 - 0.03));
      }
    }
    // ---- padded sport bar: hoops behind the front and rear seats, side rails up to the windshield header
    const yb = yWinTop + 0.014, xb = 0.248;
    for (const z of [-0.135, -0.6]) {
      for (const s2 of sides) tube([V(s2 * xb, yF, z), V(s2 * xb, yb - 0.03, z), V(s2 * (xb - 0.02), yb, z)], 0.0085);
      tube([V(-(xb - 0.02), yb, z), V(xb - 0.02, yb, z)], 0.0085);
    }
    for (const s2 of sides) {
      tube([V(s2 * (xb - 0.02), yb, 0.125), V(s2 * (xb - 0.02), yb, -0.135), V(s2 * (xb - 0.02), yb, -0.6)], 0.008);
      tube([V(s2 * (xb - 0.02), yb, 0.125), V(s2 * 0.262, yBelt + 0.04, 0.2)], 0.007);      // down the A-pillar
    }
    tube([V(-(xb - 0.02), yb, -0.135), V(xb - 0.02, yb - 0.004, -0.6)], 0.006);               // diagonal brace
  }

  // ===================================================== Chassis / frame =====
  // C-channel ladder rails (y -0.10 .. -0.03)
  for (const s of sides) {
    const pts = [[0.115, -0.10], [0.085, -0.10], [0.085, -0.092], [0.107, -0.092], [0.107, -0.038],
      [0.085, -0.038], [0.085, -0.03], [0.115, -0.03]].map(([x, y]) => [x * s, y]);
    B.add('frame', extrudeZ(polyShape(pts), -0.73, 0.73, 0.0015));
    // lightening holes along the rail web
    for (let i = 0; i < 9; i++) {
      const z = -0.6 + i * 0.15;
      if (Math.abs(z - 0.03) < 0.1) continue;
      B.add('trim', cylX(0.011, 0.003, 12), M(s * 0.1166, -0.066, z));
    }
    if (D >= 2) {
      for (let i = 0; i < 9; i++) B.add('bolt', cylX(0.0045, 0.004, 6), M(s * 0.117, -0.065, -0.7 + i * 0.18));
    }
  }
  for (const z of [0.66, 0.30, -0.30, -0.68]) B.add('frame', rbox(0.17, 0.035, 0.025, 0.004), M(0, -0.065, z));

  // link mounts on frame
  for (const sg of [1, -1]) {
    for (const s of sides) {
      B.add('frame', rbox(0.014, 0.04, 0.035, 0.004), M(s * 0.115, -0.095, sg * 0.24));
      B.add('frame', rbox(0.012, 0.03, 0.03, 0.004), M(s * 0.085, -0.04, sg * 0.31));
      // shock towers
      B.add('frame', boxBetween(V(s * 0.112, -0.035, sg * 0.47), V(s * 0.20, 0.13, sg * 0.47), 0.008, 0.03));
      B.add('frame', rbox(0.03, 0.012, 0.03, 0.004), M(s * 0.205, 0.13, sg * 0.47));
    }
  }

  // transmission, motor, skid
  // transmission: two-piece case with a round gear cover and bolts
  B.add('axle', rbox(0.08, 0.085, 0.12, 0.016), M(0, -0.07, 0.03));
  B.add('axle', cylX(0.04, 0.02, QS.cylSeg + 6), M(0.045, -0.06, 0.04));
  B.add('axle', box(0.082, 0.004, 0.122), M(0, -0.05, 0.03));
  if (D >= 1) for (let i = 0; i < 6; i++) { const a2 = (i / 6) * PI * 2; B.add('bolt', cylX(0.0035, 0.004, 6), M(0.056, -0.06 + Math.sin(a2) * 0.031, 0.04 + Math.cos(a2) * 0.031)); }
  B.add('axle', cylZ(0.012, 0.02), M(0, -0.085, 0.098));
  B.add('axle', cylZ(0.012, 0.02), M(0, -0.085, -0.038));
  // brushed motor: silver can, black end bell with brush caps
  B.add('motorCan', cylZ(0.028, 0.06, QS.cylSeg + 6), M(0, -0.03, 0.125));
  B.add('black', cylZ(0.029, 0.014, QS.cylSeg + 6), M(0, -0.03, 0.162));
  for (const s of sides) B.add('black', cylX(0.006, 0.01, 8), M(s * 0.03, -0.03, 0.162));
  if (D >= 1) {
    for (let i = 0; i < 4; i++) B.add('black', cylZ(0.0315, 0.004), M(0, -0.03, 0.105 + i * 0.016));
    B.add('red', cyl(0.002, 0.05, 5), M(0.012, -0.002, 0.17, 0.4));
    B.add('black', cyl(0.002, 0.05, 5), M(-0.012, -0.002, 0.17, 0.4));
  }
  B.add('frame', rbox(0.15, 0.012, 0.24, 0.004), M(0, -0.134, 0.03));
  B.add('frame', rbox(0.15, 0.01, 0.07, 0.003), M(0, -0.116, 0.175, 0.6));
  B.add('frame', rbox(0.15, 0.01, 0.07, 0.003), M(0, -0.116, -0.115, -0.6));
  if (D >= 1) for (const s of sides) for (const z of [-0.06, 0.12]) B.add('bolt', cyl(0.005, 0.003, 6), M(s * 0.06, -0.1415, z));

  // fuel tank skid
  B.add('steel', rbox(0.16, 0.035, 0.12, 0.006), M(0, -0.045, -0.19));

  // dark floor pan under the tub (hides the shell's light underside): cabin section + rear overhang,
  // stamped stiffening ribs, drain plugs, and a pan under the engine bay between the front fenders
  const panY = -0.0325;
  B.add('black', box(0.56, 0.003, 0.585), M(0, panY, -0.0085));
  B.add('black', box(0.56, 0.003, 0.03), M(0, panY, -0.741));
  B.add('black', box(0.34, 0.003, 0.37), M(0, 0.117, 0.485));
  B.add('black', box(0.54, 0.15, 0.003), M(0, 0.045, 0.2875));      // black liner over the tub's front face (seen through the wheel wells)
  for (const s of sides) B.add('black', box(0.003, 0.056, 0.43), M(s * 0.2355, 0.143, 0.505));   // inner fender walls under the hood
  if (D >= 1) {
    for (const x of [-0.24, -0.17, 0.17, 0.24]) B.add('black', rbox(0.022, 0.004, 0.5, 0.002), M(x, panY - 0.002, -0.01));
    for (const z of [0.2, -0.22]) B.add('black', rbox(0.1, 0.004, 0.022, 0.002), M(-0.2, panY - 0.002, z));
    for (const [x, z] of [[0.2, 0.18], [-0.2, -0.05], [0.2, -0.24]]) B.add('trim', cyl(0.007, 0.003, 10), M(x, panY - 0.002, z));
  }
  // body-mount posts from the rails up to the floor, rubber bump stops over each axle
  for (const s of sides) {
    for (const z of [0.52, 0.16, -0.16, -0.55]) {
      B.add('frame', rbox(0.026, 0.006, 0.024, 0.002), M(s * 0.124, -0.032, z));
      B.add('linkBlack', cyl(0.007, 0.004, 10), M(s * 0.124, -0.0285, z));
    }
    for (const sg of [1, -1]) {
      B.add('frame', rbox(0.024, 0.008, 0.026, 0.003), M(s * 0.1, -0.104, sg * 0.385));
      B.add('linkBlack', cyl(0.009, 0.016, 12, 0.006), M(s * 0.1, -0.116, sg * 0.385));
    }
  }
  // wiring: ESC to motor, and the servo lead running back along the left rail to the receiver
  if (D >= 1) {
    const wire = (pts, key) => B.add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.0016, 5, false));
    wire([V(0.18, -0.045, -0.075), V(0.12, -0.03, 0.0), V(0.05, -0.02, 0.1), V(0.012, -0.004, 0.16)], 'red');
    wire([V(0.17, -0.045, -0.075), V(0.11, -0.033, 0.0), V(0.04, -0.022, 0.1), V(-0.012, -0.004, 0.16)], 'black');
    wire([V(0.19, -0.04, -0.02), V(0.108, -0.035, 0.05), V(0.108, -0.035, 0.45), V(0.09, -0.06, 0.6)], 'black');
    for (const z of [0.15, 0.32, 0.5]) B.add('black', rbox(0.006, 0.006, 0.008, 0.002), M(0.106, -0.035, z));   // zip ties
  }

  // battery tray (right) and ESC / receiver (left)
  B.add('steel', box(0.12, 0.006, 0.24), M(-0.19, -0.075, -0.14));
  B.add('trim', rbox(0.1, 0.04, 0.2, 0.008), M(-0.19, -0.052, -0.14));
  for (const z of [-0.08, -0.2]) B.add('red', box(0.106, 0.044, 0.012), M(-0.19, -0.052, z));
  B.add('black', rbox(0.06, 0.025, 0.09, 0.005), M(0.19, -0.05, -0.12));
  if (D >= 1) for (let i = 0; i < 5; i++) B.add('alu', box(0.055, 0.008, 0.003), M(0.19, -0.034, -0.15 + i * 0.015));
  B.add('black', rbox(0.035, 0.02, 0.04, 0.004), M(0.19, -0.05, -0.02));
}

// -----------------------------------------------------------------------------
//  Axle housing (axle-local: origin = axle centre, X across)
// -----------------------------------------------------------------------------
function buildAxle(front, parent, mats) {
  const B = new Bin();
  const sg = front ? 1 : -1;
  const sides = [1, -1];
  const seg = QS.cylSeg;
  const dx = DIFF_X;

  // axle tubes: taper from the pumpkin out to the hub flanges
  for (const s of sides) {
    const x0 = dx + s * 0.045, x1 = s * 0.21, L = Math.abs(x1 - x0);
    B.add('axle', cylX(0.019, L, seg, 0.025), M((x0 + x1) / 2, 0, 0, 0, 0, 0, s, 1, 1));
    B.add('axle', cylX(0.027, 0.012, seg), M(s * 0.205, 0, 0));                 // hub-end flange
    B.add('axle', cylX(0.024, 0.008, seg), M(s * 0.19, 0, 0));
  }
  // diff pumpkin: lathe bulb around the pinion axis
  const bulb = new THREE.LatheGeometry([
    [0.0, -0.05], [0.03, -0.049], [0.05, -0.04], [0.06, -0.02], [0.062, 0.0], [0.058, 0.02], [0.05, 0.034], [0.0, 0.036],
  ].map(([r, y]) => new THREE.Vector2(r, y)), seg + 6);
  bulb.rotateX(PI / 2);
  B.add('axle', bulb, M(dx, 0.004, 0, 0, 0, 0, 1, 1, sg));
  // cover with a raised ring and bolts
  B.add('axle', cylZ(0.052, 0.008, seg + 6), M(dx, 0.004, sg * 0.038));
  B.add('axle', torus(0.044, 0.0035, 6, seg + 6), M(dx, 0.004, sg * 0.043));
  B.add('axle', sphere(0.04, seg, 8), M(dx, 0.004, sg * 0.043, 0, 0, 0, 1, 1, 0.25));
  if (QS.detail >= 1) {
    for (let i = 0; i < 10; i++) {
      const a2 = (i / 10) * PI * 2;
      B.add('bolt', cylZ(0.004, 0.005, 6), M(dx + Math.cos(a2) * 0.048, 0.004 + Math.sin(a2) * 0.048, sg * 0.043));
    }
  }
  // pinion snout + yoke toward the transmission
  B.add('axle', cylZ(0.024, 0.045, seg, 0.03), M(dx, 0.002, -sg * 0.065, 0, 0, 0, 1, 1, sg));
  B.add('axle', cylZ(0.016, 0.012, seg), M(dx, 0.002, -sg * 0.094));
  B.add('shaftMetal', box(0.022, 0.008, 0.012), M(dx, 0.002, -sg * 0.104));
  // gussets from pumpkin to tubes (top and bottom)
  for (const s of sides) for (const y of [0.026, -0.03]) {
    B.add('axle', boxBetween(V(dx + s * 0.035, y, 0), V(s * 0.13, y * 0.4, 0), 0.006, 0.012));
  }
  // lower-link and shock brackets with bolts
  for (const s of sides) {
    B.add('axle', rbox(0.024, 0.045, 0.034, 0.005), M(s * 0.165, -0.035, -sg * 0.01));
    B.add('bolt', cylX(0.005, 0.03, 6), M(s * 0.165, -0.048, -sg * 0.01));
    B.add('axle', rbox(0.018, 0.034, 0.03, 0.004), M(s * 0.215, 0.018, -sg * 0.03));
    B.add('bolt', cylX(0.004, 0.024, 6), M(s * 0.215, 0.03, -sg * 0.03));
    B.add('axle', rbox(0.014, 0.034, 0.03, 0.004), M(dx + s * 0.035, 0.058, -sg * 0.02));   // upper-link ears
  }
  if (front) {
    // C-hubs: half rings around the kingpin axis, plus kingpin bosses
    for (const s of sides) {
      const ch = new THREE.TorusGeometry(0.045, 0.009, 8, 14, PI);
      ch.rotateZ(-PI / 2);
      B.add('linkBlack', ch, M(s * 0.214, 0, 0, 0, 0, 0, 1, 1, 1));
      for (const y of [0.044, -0.044]) B.add('bolt', cyl(0.006, 0.01, 8), M(s * 0.236, y, 0));
    }
    // axle-mounted steering servo on a plate
    B.add('axle', rbox(0.07, 0.006, 0.04, 0.002), M(0.1, 0.03, 0.03));
    B.add('black', rbox(0.05, 0.03, 0.028, 0.004), M(0.1, 0.048, 0.03));
    B.add('trim', box(0.052, 0.004, 0.03), M(0.1, 0.064, 0.03));
    B.add('bolt', cyl(0.004, 0.006, 8), M(0.1, 0.067, 0.03));
  } else {
    // rear: lockout hubs with hex faces + tubular truss over the pumpkin
    for (const s of sides) {
      B.add('axle', cylX(0.028, 0.03, 6), M(s * 0.245, 0, 0));
      B.add('axle', cylX(0.033, 0.006, seg), M(s * 0.228, 0, 0));
      B.add('axle', rodGeo(V(dx, 0.062, 0), V(s * 0.19, 0.02, 0), 0.0055));
    }
  }
  return B.build(parent, mats);
}

/** Front steering knuckle geometry (knuckle-local: origin at hub, inboard = -side X). */
function buildKnuckle(side) {
  const B = new Bin();
  const ix = -side;
  B.add('linkBlack', rbox(0.024, 0.078, 0.042, 0.008), M(ix * 0.085, 0, 0));
  B.add('linkBlack', rbox(0.012, 0.012, 0.055, 0.004), M(ix * 0.088, 0.045, 0.022));
  B.add('linkBlack', rbox(0.012, 0.012, 0.09, 0.004), M(ix * 0.085, -0.03, 0.04));
  B.add('linkBlack', cylX(0.016, 0.09, QS.cylSeg, 0.012), M(ix * 0.04, 0, 0));
  B.add('bolt', cyl(0.005, 0.008, 6), M(ix * 0.085, 0.041, 0));
  B.add('bolt', cyl(0.005, 0.008, 6), M(ix * 0.085, -0.041, 0));
  return B;
}

// Dynamic rod-like parts, built along +Y from 0..L0 ---------------------------
function linkGeometry(L0) {
  const B = new Bin();
  // moulded plastic link: thicker in the middle, hex-ish ends
  B.add('alu', cyl(0.0068, Math.max(0.01, L0 - 0.03), 8, 0.0068), M(0, L0 / 2, 0));
  B.add('alu', cyl(0.008, Math.max(0.01, L0 * 0.5), 8), M(0, L0 / 2, 0));
  for (const y of [0.012, L0 - 0.012]) B.add('alu', cyl(0.0088, 0.02, 6), M(0, y, 0));
  for (const y of [0, L0]) B.add('alu', cylX(0.0098, 0.012, 12), M(0, y, 0));
  const g = mergeGeometries(B.map.get('alu'), false);
  B.map.get('alu').forEach((x) => x.dispose());
  return g;
}
function rodGeometry(L0, r) {
  const B = new Bin();
  B.add('alu', cyl(r, L0, 8), M(0, L0 / 2, 0));
  for (const y of [0, L0]) B.add('alu', sphere(r * 1.9, 8, 6), M(0, y, 0));
  const g = mergeGeometries(B.map.get('alu'), false);
  B.map.get('alu').forEach((x) => x.dispose());
  return g;
}
function driveshaftGeometry(L0) {
  const B = new Bin();
  B.add('alu', cyl(0.0065, L0 - 0.03, 10), M(0, L0 / 2, 0));
  B.add('alu', cyl(0.0095, L0 * 0.4, 10), M(0, 0.02 + L0 * 0.2, 0));
  for (const y of [0.008, L0 - 0.008]) {
    B.add('alu', box(0.018, 0.016, 0.006), M(0, y, 0));
    B.add('alu', box(0.006, 0.016, 0.018), M(0, y, 0));
  }
  const g = mergeGeometries(B.map.get('alu'), false);
  B.map.get('alu').forEach((x) => x.dispose());
  return g;
}

// -----------------------------------------------------------------------------
//  Ackermann split of a single steering angle (positive = left turn)
// -----------------------------------------------------------------------------
function ackermann(s) {
  if (Math.abs(s) < 1e-4) return [s, s];
  const wb = CRAWLER_DIMS.wheelBase, t = CRAWLER_DIMS.track;
  const R = wb / Math.tan(Math.abs(s));
  const inner = Math.atan(wb / Math.max(0.05, R - t / 2));
  const outer = Math.atan(wb / (R + t / 2));
  const sg = Math.sign(s);
  // left turn: left (FL) wheel is the inner one
  return s > 0 ? [inner * sg, outer * sg] : [outer * sg, inner * sg];
}

// =============================================================================
//  createCrawler
// =============================================================================
export function createCrawler(opts = {}) {
  QS = QUALITY[opts.quality] || QUALITY.high;
  const bodyColor = opts.bodyColor ?? 0xf1f1ee;   // Axial SCX30 JLU, gloss white

  const dirtU = { uDust: { value: 0 }, uMud: { value: 0 }, uWet: { value: 0 } };
  const mats = makeMaterials(bodyColor, dirtU);

  const group = new THREE.Group();
  group.name = 'Crawler';

  // ------------------------------------------------------------ Body --------
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'CrawlerBody';
  group.add(bodyGroup);
  const bodyBin = new Bin();
  buildBody(bodyBin);
  const bodyMeshes = bodyBin.build(bodyGroup, mats);
  bodyGroup.scale.x = 1.03;

  // ------------------------------------------------------- Wheel geometry ---
  const tireGeo = buildTireGeometry();
  const rimGeo = buildRimGeometries();

  // moulded sidewall lettering: a thin ring that follows the outer sidewall bulge
  const sidewallGeo = (() => {
    if (!mats.sidewall) return null;
    const g = new THREE.RingGeometry(0.15, 0.222, QS.tireSeg, 2);
    const pos = g.attributes.position;
    // outer sidewall profile (radius -> axial offset), from the carcass lathe profile
    const prof = [[0.14, 0.082], [0.158, 0.087], [0.170, 0.090], [0.192, 0.093], [0.215, 0.095], [0.230, 0.092]];
    const axialAt = (r) => {
      for (let i = 0; i < prof.length - 1; i++) {
        const [r0, a0] = prof[i], [r1, a1] = prof[i + 1];
        if (r <= r1) return a0 + (a1 - a0) * Math.max(0, (r - r0) / (r1 - r0));
      }
      return prof[prof.length - 1][1];
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y);
      pos.setXYZ(i, axialAt(r) + 0.0016, y, -x);   // ring plane -> facing +X (outer face)
    }
    g.computeVertexNormals();
    return g;
  })();

  const WHEEL_R = CRAWLER_DIMS.wheelRadius / 0.27, WHEEL_W = 0.9;
  const makeWheelVisual = () => {
    const w = new THREE.Group();
    w.scale.set(WHEEL_W, WHEEL_R, WHEEL_R);
    const tire = new THREE.Mesh(tireGeo, mats.rubber);
    tire.castShadow = tire.receiveShadow = true;
    tire.name = 'tire';
    const rim = new THREE.Mesh(rimGeo.black, mats.rim);
    rim.castShadow = rim.receiveShadow = true;
    rim.name = 'rim';
    w.add(tire, rim);
    if (sidewallGeo) {
      const sw = new THREE.Mesh(sidewallGeo, mats.sidewall);
      sw.name = 'sidewall'; sw.receiveShadow = true;
      w.add(sw);
    }
    if (rimGeo.metal) {
      const met = new THREE.Mesh(rimGeo.metal, mats.bolt);
      met.castShadow = false;
      met.receiveShadow = true;
      met.name = 'rimHardware';
      w.add(met);
    }
    return w;
  };

  // Spare tyre on the tailgate (sprung, static)
  {
    const spare = makeWheelVisual();
    spare.position.set(0, 0.19, -0.85);
    spare.rotation.y = PI / 2;            // outer face toward -Z
    spare.scale.set(WHEEL_W, WHEEL_R, WHEEL_R / 1.03);   // full-size spare; undo the body's x-widening so it stays round
    bodyGroup.add(spare);
    spare.traverse((o) => { if (o.isMesh) bodyMeshes.push(o); });
  }

  // ------------------------------------------------------------- Axles ------
  const axles = [];
  for (let a = 0; a < 2; a++) {
    const ag = new THREE.Group();
    ag.name = a === 0 ? 'FrontAxle' : 'RearAxle';
    ag.position.set(0, REST_Y, AXLE_Z[a]);
    buildAxle(a === 0, ag, mats);
    group.add(ag);
    axles.push(ag);
  }

  // Servo horn (front axle child)
  const SERVO_OUT = V(0.105, 0.066, 0.03);
  const HORN_LEN = 0.025;
  const horn = new THREE.Mesh(prep(box(0.008, 0.005, HORN_LEN + 0.008)).translate(0, 0, HORN_LEN / 2), mats.shaftMetal);
  horn.position.copy(SERVO_OUT);
  horn.castShadow = false;
  axles[0].add(horn);

  // ------------------------------------------------- Knuckles + wheels -----
  const knuckles = [], spinners = [];
  for (let i = 0; i < 4; i++) {
    const side = HUB_X[i] > 0 ? 1 : -1;
    const k = new THREE.Group();
    k.name = ['FL', 'FR', 'RL', 'RR'][i] + '_hub';
    k.rotation.order = 'ZYX';            // roll (axle) * steer * (spin in child)
    k.position.set(HUB_X[i], REST_Y, AXLE_Z[i >> 1]);
    if (i < 2) buildKnuckle(side).build(k, mats);
    const spinner = new THREE.Group();
    const vis = makeWheelVisual();
    if (side < 0) vis.rotation.y = PI;   // outer face toward -X on the right side
    spinner.add(vis);
    k.add(spinner);
    group.add(k);
    knuckles.push(k);
    spinners.push(spinner);
  }

  // --------------------------------------------------- 4-link suspension ----
  const _a = V(), _b = V(), _d = V();
  const UP = V(0, 1, 0);
  const restAxleMatrix = (a) => new THREE.Matrix4().makeTranslation(0, REST_Y, AXLE_Z[a]);
  /** Place a +Y-built part between a and b; scale Y by L/L0 when L0 given. */
  const orient = (obj, a, b, L0) => {
    _d.subVectors(b, a);
    const L = _d.length();
    obj.position.copy(a);
    if (L > 1e-6) obj.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / L));
    if (L0) obj.scale.set(1, L / L0, 1);
    return L;
  };

  const links = [];
  for (let a = 0; a < 2; a++) {
    const sg = a === 0 ? 1 : -1;
    for (const s of [1, -1]) {
      const defs = [
        { frame: V(s * 0.115, -0.105, sg * 0.24), local: V(s * 0.165, -0.05, -sg * 0.015) },  // lower
        { frame: V(s * 0.085, -0.04, sg * 0.31), local: V(DIFF_X + s * 0.04, 0.062, -sg * 0.02) }, // upper
      ];
      for (const d of defs) {
        const L0 = d.frame.distanceTo(d.local.clone().applyMatrix4(restAxleMatrix(a)));
        const mesh = new THREE.Mesh(linkGeometry(L0), mats.linkBlack);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.name = 'link';
        group.add(mesh);
        links.push({ mesh, axle: a, frame: d.frame, local: d.local, L0 });
      }
    }
  }

  // ------------------------------------------------------- Coil-overs -------
  const SPRING_BOTTOM = 0.0145, SPRING_TOP_OFF = 0.0365;
  const shocks = [];
  for (let i = 0; i < 4; i++) {
    const a = i >> 1, sg = a === 0 ? 1 : -1, s = HUB_X[i] > 0 ? 1 : -1;
    const chassis = V(s * 0.20, 0.13, sg * 0.47);
    const local = V(s * 0.215, 0.025, -sg * 0.03);
    const L0 = chassis.distanceTo(local.clone().applyMatrix4(restAxleMatrix(a)));

    const g = new THREE.Group();
    g.name = 'shock';
    // lower eyelet + spring perch
    const lowB = new Bin();
    lowB.add('shock', cylX(0.008, 0.012, 10), M(0, 0, 0));
    lowB.add('shock', cyl(0.022, 0.005, QS.cylSeg), M(0, 0.012, 0));
    lowB.build(g, mats);
    // chrome shaft
    const shaft = new THREE.Mesh(cyl(0.0045, 0.17, 8).translate(0, 0.091, 0), mats.shaftMetal);
    shaft.castShadow = true;
    g.add(shaft);
    // body (top at y = L, extends downward)
    const bodyB = new Bin();
    bodyB.add('shock', cylX(0.008, 0.012, 10), M(0, 0.004, 0));
    bodyB.add('shock', cyl(0.0165, 0.016, QS.cylSeg), M(0, -0.008, 0));
    bodyB.add('shock', cyl(0.0135, 0.104, QS.cylSeg), M(0, -0.068, 0));
    bodyB.add('shock', cyl(0.024, 0.005, QS.cylSeg), M(0, -0.034, 0));
    bodyB.add('shock', cyl(0.0155, 0.008, QS.cylSeg), M(0, -0.12, 0));
    if (QS.detail >= 3) {
      bodyB.add('shock', cyl(0.008, 0.06, 10), M(0.024 * -s, -0.045, 0));
      bodyB.add('shock', box(0.014, 0.01, 0.008), M(0.016 * -s, -0.012, 0));
    }
    const body = new THREE.Group();
    bodyB.build(body, mats);
    g.add(body);
    // spring
    const Ls0 = L0 - SPRING_BOTTOM - SPRING_TOP_OFF;
    const helix = new HelixCurve(0.0205, Ls0, QS.springTurns);
    const springGeo = new THREE.TubeGeometry(helix, QS.springTurns * QS.springSeg, 0.0026, 6, false);
    const spring = new THREE.Mesh(springGeo, mats.spring);
    spring.castShadow = spring.receiveShadow = true;
    spring.position.y = SPRING_BOTTOM;
    g.add(spring);

    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    shocks.push({ group: g, body, spring, chassis, local, axle: a, Ls0 });
  }

  // -------------------------------------------------------- Steering --------
  const TIE_ARM = (side) => V(-side * 0.085, -0.03, 0.083);
  const DRAG_ARM = V(-0.088, 0.045, 0.045);       // on left knuckle
  const tieL0 = TIE_ARM(1).add(V(HUB_X[0], 0, 0)).distanceTo(TIE_ARM(-1).add(V(HUB_X[1], 0, 0)));
  const tieRod = new THREE.Mesh(rodGeometry(tieL0, 0.0055), mats.linkBlack);
  const hornEndRest = V(SERVO_OUT.x, SERVO_OUT.y, SERVO_OUT.z + HORN_LEN);
  const dragL0 = hornEndRest.distanceTo(DRAG_ARM.clone().add(V(HUB_X[0], 0, 0)));
  const dragLink = new THREE.Mesh(rodGeometry(dragL0, 0.0045), mats.linkBlack);
  for (const m of [tieRod, dragLink]) { m.castShadow = m.receiveShadow = true; group.add(m); }

  // ------------------------------------------------------ Driveshafts -------
  const TRANS_OUT = [V(0, -0.085, 0.108), V(0, -0.085, -0.048)];
  const PINION = [V(DIFF_X, 0, -0.115), V(DIFF_X, 0, 0.115)];
  const driveshafts = [];
  for (let a = 0; a < 2; a++) {
    const L0 = TRANS_OUT[a].distanceTo(PINION[a].clone().applyMatrix4(restAxleMatrix(a)));
    const outer = new THREE.Group();
    const inner = new THREE.Mesh(driveshaftGeometry(L0), mats.shaftMetal);
    inner.castShadow = inner.receiveShadow = true;
    outer.add(inner);
    group.add(outer);
    driveshafts.push({ outer, inner, L0 });
  }

  // ----------------------------------------------------------- Lights -------
  const spots = [];
  for (const s of [1, -1]) {
    const spot = new THREE.SpotLight(0xffece0, 0, 14, 0.6, 0.6, 1.5);
    spot.castShadow = false;
    spot.position.set(s * 0.19, 0.158, 0.74);
    const target = new THREE.Object3D();
    target.position.set(s * 0.3, -0.9, 6.0);
    group.add(target);
    spot.target = target;
    group.add(spot);
    spots.push(spot);
  }
  let lightsOn = false;
  let brake = 0;
  const applyLightState = () => {
    mats.headLens.emissiveIntensity = lightsOn ? 3.0 : 0.0;
    mats.barLens.emissiveIntensity = lightsOn ? 4.0 : 0.0;
    mats.amber.emissiveIntensity = lightsOn ? 1.2 : 0.0;
    mats.tailLens.emissiveIntensity = Math.max(lightsOn ? 0.7 : 0.0, brake * 4.0);
    mats.brakeLens.emissiveIntensity = brake * 4.0;
    for (const sp of spots) sp.intensity = lightsOn ? 30 : 0;
  };

  // ----------------------------------------------------------- update -------
  const tmpM = new THREE.Matrix4();
  const tieA = V(), tieB = V(), dragA = V(), dragB = V();
  function update(state = {}) {
    const hubY = state.hubY || REST_HUB_Y;
    const spin = state.spin || ZERO4;
    const steer = state.steer || 0;
    const [sl, sr] = ackermann(steer);

    // Solid axles
    for (let a = 0; a < 2; a++) {
      const yL = hubY[a * 2], yR = hubY[a * 2 + 1];
      const ax = axles[a];
      ax.position.set(0, (yL + yR) * 0.5, AXLE_Z[a]);
      ax.rotation.set(0, 0, Math.atan2(yL - yR, CRAWLER_DIMS.track));
      ax.updateMatrix();
    }

    // Hubs / wheels
    for (let i = 0; i < 4; i++) {
      const a = i >> 1;
      const k = knuckles[i];
      k.position.set(HUB_X[i], hubY[i], AXLE_Z[a]);
      k.rotation.set(0, i === 0 ? sl : i === 1 ? sr : 0, axles[a].rotation.z);
      k.updateMatrix();
      spinners[i].rotation.x = spin[i];
    }

    // Links
    for (const L of links) {
      _b.copy(L.local).applyMatrix4(axles[L.axle].matrix);
      orient(L.mesh, L.frame, _b, L.L0);
    }

    // Coil-overs: shaft fixed to lower eye, body fixed to chassis eye, spring stretches
    for (const sh of shocks) {
      _a.copy(sh.local).applyMatrix4(axles[sh.axle].matrix);
      const len = orient(sh.group, _a, sh.chassis);
      sh.body.position.y = len;
      sh.spring.scale.y = Math.max(0.05, len - SPRING_BOTTOM - SPRING_TOP_OFF) / sh.Ls0;
    }

    // Steering linkage
    const hornAng = sl * 1.6;
    horn.rotation.y = hornAng;
    dragA.set(SERVO_OUT.x + Math.sin(hornAng) * HORN_LEN, SERVO_OUT.y, SERVO_OUT.z + Math.cos(hornAng) * HORN_LEN)
      .applyMatrix4(axles[0].matrix);
    dragB.copy(DRAG_ARM).applyMatrix4(knuckles[0].matrix);
    orient(dragLink, dragA, dragB, dragL0);
    tieA.copy(TIE_ARM(1)).applyMatrix4(knuckles[0].matrix);
    tieB.copy(TIE_ARM(-1)).applyMatrix4(knuckles[1].matrix);
    orient(tieRod, tieA, tieB, tieL0);

    // Driveshafts
    for (let a = 0; a < 2; a++) {
      const ds = driveshafts[a];
      _b.copy(PINION[a]).applyMatrix4(axles[a].matrix);
      orient(ds.outer, TRANS_OUT[a], _b, ds.L0);
      ds.inner.rotation.y = (spin[a * 2] + spin[a * 2 + 1]) * 0.5 * 3.2 * (a === 0 ? 1 : -1);
    }
  }

  // ------------------------------------------------------------- API --------
  function setLights(on) {
    lightsOn = !!on;
    applyLightState();
  }
  function setBrake(amount) {
    brake = Math.min(1, Math.max(0, amount || 0));
    applyLightState();
  }
  function setDirt({ dust, mud, wet } = {}) {
    const c = (v, prev) => (v === undefined || v === null ? prev : Math.min(1, Math.max(0, v)));
    dirtU.uDust.value = c(dust, dirtU.uDust.value);
    dirtU.uMud.value = c(mud, dirtU.uMud.value);
    dirtU.uWet.value = c(wet, dirtU.uWet.value);
  }
  function dispose() {
    const geos = new Set(), ms = new Set(), texs = new Set();
    group.traverse((o) => {
      if (o.isMesh) {
        geos.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => ms.add(m));
      }
      if (o.isSpotLight) o.dispose?.();
    });
    for (const m of Object.values(mats)) ms.add(m);
    for (const m of ms) {
      for (const k of ['map', 'roughnessMap', 'normalMap', 'bumpMap']) if (m[k]) texs.add(m[k]);
      m.dispose();
    }
    geos.forEach((g) => g.dispose());
    texs.forEach((t) => t.dispose());
    group.removeFromParent();
    group.clear();
  }

  applyLightState();
  update({ hubY: REST_HUB_Y, steer: 0, spin: ZERO4, dt: 0 });

  return {
    group,
    update,
    setLights,
    setBrake,
    setDirt,
    bodyMeshes,
    dispose,
  };
}
