// Realistic grass: painted blade textures on crossed, bending alpha-tested cards.
// 'green' = mixed meadow/forest grass with a few dead blades, 'dry' = straw grass with seed heads.
import * as THREE from 'three';
import { Rng } from '../core/noise.js';

const texCache = {};

function getGrassTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const W = 256, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = new Rng(kind === 'dry' ? 2024 : 1977);
  const dry = kind === 'dry';
  const n = dry ? 46 : 64;
  // back-to-front: tall faint blades behind, short dark blades in front
  const blades = [];
  for (let i = 0; i < n; i++) blades.push({ x: W / 2 + rng.gauss() * W * 0.18, h: rng.float(0.35, 0.97), lean: rng.float(-0.45, 0.45), w: rng.float(2.2, 4.6), dead: rng.next() < (dry ? 0.0 : 0.12) });
  blades.sort((a, b) => b.h - a.h);
  for (const b of blades) {
    const x0 = Math.max(6, Math.min(W - 6, b.x)), y0 = H;
    const len = b.h * H;
    const tipX = x0 + b.lean * len * 0.55, tipY = H - len;
    const cx = x0 + b.lean * len * 0.1, cy = H - len * 0.55;
    const grad = g.createLinearGradient(0, H, 0, tipY);
    let base, mid, tip;
    if (dry) {
      const l = rng.float(52, 66);
      base = `hsl(32,22%,${l - 30}%)`; mid = `hsl(${40 + rng.float(-4, 6)},${30 + rng.float(0, 12)}%,${l}%)`; tip = `hsl(44,30%,${l + 10}%)`;
    } else if (b.dead) {
      base = 'hsl(35,20%,14%)'; mid = 'hsl(40,26%,34%)'; tip = 'hsl(42,28%,46%)';
    } else {
      const h = 88 + rng.float(-14, 12), s = 34 + rng.float(0, 18);
      base = `hsl(${h},${s}%,13%)`; mid = `hsl(${h},${s}%,${20 + rng.float(0, 8)}%)`; tip = `hsl(${h - 12},${s - 6}%,${34 + rng.float(0, 10)}%)`;
    }
    grad.addColorStop(0, base); grad.addColorStop(0.45, mid); grad.addColorStop(1, tip);
    g.fillStyle = grad;
    // tapered curved blade
    g.beginPath();
    g.moveTo(x0 - b.w * 0.3, y0);
    g.quadraticCurveTo(cx - b.w * 0.4, cy, tipX, tipY);
    g.quadraticCurveTo(cx + b.w * 0.4, cy, x0 + b.w * 0.3, y0);
    g.closePath();
    g.fill();
    // midrib highlight on wide green blades
    if (!dry && b.w > 3.6) {
      g.strokeStyle = 'rgba(210,230,160,0.18)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, tipX, tipY); g.stroke();
    }
  }
  // seed heads on dry grass (oat-like drooping spikelets)
  if (dry) {
    for (let i = 0; i < 9; i++) {
      const x0 = W / 2 + rng.gauss() * W * 0.14, top = rng.float(0.05, 0.25) * H, lean = rng.float(-0.3, 0.3);
      g.strokeStyle = 'hsl(38,28%,58%)'; g.lineWidth = 1.2;
      const tx = x0 + lean * (H - top) * 0.4;
      g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0, (H + top) / 2, tx, top); g.stroke();
      for (let k = 0; k < 7; k++) {
        const t = k / 7, sx = tx + (x0 - tx) * t * 0.15, sy = top + t * 40;
        g.fillStyle = `hsl(${40 + rng.float(-4, 4)},34%,${62 + rng.float(-6, 8)}%)`;
        g.beginPath(); g.ellipse(sx + (k % 2 ? 4 : -4), sy + 3, 2.2, 5.5, (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2); g.fill();
      }
    }
  } else {
    // a few seed stalks in green grass too
    for (let i = 0; i < 4; i++) {
      const x0 = W / 2 + rng.gauss() * W * 0.12, top = rng.float(0.02, 0.12) * H;
      g.strokeStyle = 'hsl(70,24%,30%)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, H); g.lineTo(x0 + rng.float(-10, 10), top); g.stroke();
      g.fillStyle = 'hsl(48,26%,42%)';
      g.beginPath(); g.ellipse(x0, top + 10, 2, 9, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache[kind] = t;
  return t;
}

// Tuft: 3 crossed cards (2 rows each so the top can bend), ~0.7 wide x 1 tall at scale 1
export function grassTuftGeometry(seed, kind, detail) {
  const rng = new Rng(seed);
  const cards = detail > 1 ? 3 : 2;
  const rows = 2;
  const pos = [], uv = [], nor = [], col = [], idx = [];
  for (let c = 0; c < cards; c++) {
    const a = (c / cards) * Math.PI + rng.float(-0.2, 0.2);
    const w = rng.float(0.6, 0.8), h = rng.float(0.85, 1.05);
    const dx = Math.cos(a), dz = Math.sin(a);
    const lean = rng.float(-0.12, 0.12);
    const base = pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      for (const k of [-1, 1]) {
        const x = dx * k * w * 0.5 * (1 + t * 0.25), z = dz * k * w * 0.5 * (1 + t * 0.25);
        pos.push(x - dz * lean * t * t, t * h * 1.12 - 0.12, z + dx * lean * t * t);
        uv.push(k < 0 ? 0 : 1, t);
        // soft, mostly-up normals like real grass canopies
        nor.push(-dz * 0.25, 1, dx * 0.25);
        const ao = 0.62 + 0.45 * t;
        col.push(ao, ao, ao);
      }
    }
    for (let r = 0; r < rows; r++) { const q = base + r * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function createGrassMaterial(kind, quality, windUniforms) {
  const fade = { low: [18, 26], medium: [26, 36], high: [34, 48], ultra: [46, 64] }[quality] || [34, 48];
  const m = new THREE.MeshStandardMaterial({
    map: getGrassTexture(kind), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: kind === 'dry' ? 0.9 : 0.78, metalness: 0, envMapIntensity: 0.5,
  });
  m.alphaToCoverage = quality !== 'low';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, windUniforms);
    sh.uniforms.uFade = { value: new THREE.Vector2(fade[0], fade[1]) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform vec2 uFade;')
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        {
          vec3 ip = vec3(0.);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          // shrink into the ground with distance (no popping, saves fill)
          float d = distance(ip, cameraPosition);
          float keep = 1.0 - smoothstep(uFade.x, uFade.y, d);
          transformed.y *= keep;
          // rolling gusts across the field + per-tuft flutter, bending the tops
          float k = position.y * position.y;
          float gust = sin(dot(ip.xz, vec2(0.21, 0.13)) - uTime * 1.6) * 0.5 + 0.5;
          gust = gust * gust;
          float flutter = sin(uTime * 3.7 + ip.x * 3.1 + ip.z * 2.3 + position.x * 9.) * 0.05;
          transformed.x += (0.04 + gust * 0.16 + flutter) * k * uWind;
          transformed.z += (gust * 0.07 + flutter * 0.6) * k * uWind;
          transformed.y -= gust * 0.05 * k * uWind;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * 0.05;');
  };
  m.customProgramCacheKey = () => 'grass-' + kind + quality;
  return m;
}
