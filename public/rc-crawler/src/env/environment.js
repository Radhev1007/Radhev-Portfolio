// Sky, sun, cloud dome, fog, image-based lighting and the four time/weather presets.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { sharedTerrainUniforms } from '../terrain/terrainMaterial.js';

export const PRESETS = {
  morning: {
    label: 'Morning', elev: 18, azim: 115, sunColor: 0xfff0dc, sunI: 2.8, hemiSky: 0xbcd4ff, hemiGround: 0x6b5a48, hemiI: 0.95,
    turbidity: 2.6, rayleigh: 1.6, mie: 0.004, mieG: 0.8, fog: 0xb9c6d2, fogD: 0.0065, exposure: 0.85, clouds: 0.38, cloudTint: 0xfffaf2, haze: 0.85, cirrus: 0.7, dark: 0.0,
    wet: 0.08, grade: { warm: -0.02, contrast: 1.05, sat: 0.98, lift: 0.01 }, shadowSoft: 1.5, wind: 0.8,
  },
  golden: {
    label: 'Golden Hour', elev: 11, azim: 250, sunColor: 0xffb672, sunI: 3.8, hemiSky: 0xa9bde0, hemiGround: 0x6a4c36, hemiI: 0.95,
    turbidity: 6, rayleigh: 2.2, mie: 0.005, mieG: 0.87, fog: 0xd8a578, fogD: 0.006, exposure: 0.85, clouds: 0.48, cloudTint: 0xffd3a8, haze: 0.95, cirrus: 0.9, dark: 0.0,
    wet: 0, grade: { warm: 0.06, contrast: 1.1, sat: 1.06, lift: 0.0 }, shadowSoft: 1.2, wind: 1,
  },
  overcast: {
    label: 'Overcast', elev: 38, azim: 200, sunColor: 0xdfe4ea, sunI: 0.55, hemiSky: 0xc4ccd6, hemiGround: 0x4a463f, hemiI: 1.6,
    turbidity: 18, rayleigh: 0.35, mie: 0.02, mieG: 0.7, fog: 0x9ea6ad, fogD: 0.01, exposure: 0.8, clouds: 1.0, cloudTint: 0xc4c9cf, haze: 1.0, cirrus: 0.0, dark: 1.0,
    wet: 0.15, grade: { warm: -0.01, contrast: 1.0, sat: 0.85, lift: 0.02 }, shadowSoft: 6, wind: 1.6,
  },
  rain: {
    label: 'After Rain', elev: 20, azim: 160, sunColor: 0xfde8d0, sunI: 1.7, hemiSky: 0xaebccc, hemiGround: 0x3e3a34, hemiI: 1.2,
    turbidity: 8, rayleigh: 1.3, mie: 0.01, mieG: 0.8, fog: 0xa4adb4, fogD: 0.011, exposure: 0.75, clouds: 0.72, cloudTint: 0xe2e6ea, haze: 0.95, cirrus: 0.3, dark: 0.55,
    wet: 1, grade: { warm: 0.0, contrast: 1.08, sat: 0.92, lift: 0.01 }, shadowSoft: 2.5, wind: 1.2,
  },
};

// Sky dome overlay: horizon haze (aerial perspective blending the sky into the fog colour) +
// lit cumulus layer (warped fbm, light marched toward the sun for dark bases / bright tops / silver lining)
// + a high wispy cirrus layer. Rendered behind everything; also baked into the IBL environment.
const CLOUD_FRAG = /* glsl */`
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uTint; uniform vec3 uFog; uniform vec3 uSkyAmb;
uniform float uCover; uniform float uTime; uniform float uHaze; uniform float uCirrus; uniform float uDark;
varying vec3 vDir;

float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * f * (f * (f * 6. - 15.) + 10.);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
const mat3 ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
float fbm(vec3 p, int oct){ float s = 0., a = 0.5; for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * vn3(p); p = ROT * p * 2.03; a *= 0.5; } return s; }

// cumulus density on the cloud plane. The domain warp is computed once per pixel and reused by the
// cheaper shadow samples (base shape only), which keeps the sky affordable on every pixel.
vec2 cloudWarp(vec2 uv, float t){
  vec3 p = vec3(uv, t * 0.015);
  return vec2(fbm(p * 0.45 + vec3(0., 0., 3.1), 3), fbm(p * 0.45 + vec3(5.2, 1.3, 0.), 3)) - 0.5;
}
float coverRemap(float n){
  float th = mix(0.56, 0.24, uCover);
  return smoothstep(th, th + mix(0.16, 0.3, uCover), n);
}
float cumulus(vec2 uv, vec2 w, float t, int oct){
  float base = fbm(vec3(uv * 0.55 + w * 1.1, t * 0.01), oct);
  float billow = 1.0 - abs(fbm(vec3(uv * 1.7 + w * 0.6, t * 0.02 + 7.0), 4) * 2.0 - 1.0);
  return coverRemap(base * 0.78 + billow * 0.22);
}
float cumulusLite(vec2 uv, vec2 w, float t){
  return coverRemap(fbm(vec3(uv * 0.55 + w * 1.1, t * 0.01), 3) * 0.78 + 0.11);
}

float hg(float mu, float g){ float g2 = g * g; return (1. - g2) / (12.566 * pow(1. + g2 - 2. * g * mu, 1.5)); }

void main(){
  vec3 d = normalize(vDir);
  float mu = dot(d, uSunDir);
  // ---- horizon haze (always): denser toward the horizon, warmer toward the sun
  vec3 hazeCol = mix(uFog, uFog * 0.6 + uSunCol * 0.55, pow(max(mu, 0.0), 6.0) * 0.8);
  float haze = (1.0 - smoothstep(-0.03, 0.22, d.y)) * uHaze;
  if (d.y < 0.0) { gl_FragColor = vec4(hazeCol, 1.0); return; }

  // ---- cumulus layer projected onto a plane; distance grows toward the horizon
  float dist = 1.0 / max(d.y, 0.035);
  vec2 wind = vec2(uTime * 0.0035, uTime * 0.0012);
  vec2 uv = d.xz * dist * 1.25 + wind;
  int oct = ${'${OCT}'};
  vec2 cw = cloudWarp(uv, uTime);
  float den = cumulus(uv, cw, uTime, oct);
  vec4 cloud = vec4(0.0);
  if (den > 0.002) {
    // march toward the sun across the plane for self-shadowing
    vec2 sd = normalize(uSunDir.xz + 1e-4) * 0.11;
    float occ = 0.0;
    for (int i = 1; i <= 4; i++) occ += cumulusLite(uv + sd * float(i), cw, uTime) * (1.0 - float(i) * 0.12);
    float elev = clamp(uSunDir.y * 3.0 + 0.25, 0.0, 1.0);
    float light = exp(-occ * 0.9) * elev;
    float powder = 1.0 - exp(-den * 3.0);
    float phase = mix(0.09, hg(mu, 0.62) * 4.0, 0.55) + hg(mu, -0.25) * 0.4;
    vec3 amb = mix(uSkyAmb * 0.55, uTint * 0.75, 0.5) * (1.0 - uDark * 0.55);
    vec3 col = amb * (0.65 + 0.35 * den);                       // ambient from sky
    col += uSunCol * uTint * light * powder * (0.9 + phase * 2.2); // direct sun + forward-scatter
    // silver lining: thin edges glow when looking toward the sun
    col += uSunCol * pow(max(mu, 0.0), 10.0) * (1.0 - den) * light * 2.5;
    // the underside of thick cloud is darker
    col *= mix(1.0, 0.55, smoothstep(0.4, 1.0, den) * (1.0 - light) * (0.6 + uDark * 0.4));
    float a = den * smoothstep(0.0, 0.09, d.y);
    // aerial perspective: distant clouds fade into the haze
    float far = 1.0 - exp(-dist * 0.055);
    col = mix(col, hazeCol, far * 0.75);
    a *= 1.0 - far * 0.55;
    cloud = vec4(col, a);
  }
  // ---- cirrus: high, thin, wind-stretched streaks
  vec4 ci = vec4(0.0);
  if (uCirrus > 0.01) {
    vec2 cuv = d.xz * dist * 0.35 + wind * 0.6;
    cuv = mat2(0.86, -0.5, 0.5, 0.86) * cuv;
    float c = fbm(vec3(cuv.x * 0.7, cuv.y * 3.2, uTime * 0.004), 5);
    c = smoothstep(0.52, 0.8, c) * uCirrus * smoothstep(0.02, 0.25, d.y);
    vec3 cc = mix(uSkyAmb, vec3(1.0), 0.6) * 0.8 + uSunCol * (0.35 + hg(mu, 0.5) * 1.5);
    ci = vec4(mix(cc, hazeCol, 1.0 - exp(-dist * 0.03)), c * 0.55);
  }
  // composite: cirrus behind cumulus, haze over both near the horizon
  vec3 col = ci.rgb * ci.a * (1.0 - cloud.a) + cloud.rgb * cloud.a;
  float a = ci.a * (1.0 - cloud.a) + cloud.a;
  col = col * (1.0 - haze) + hazeCol * haze;
  a = a * (1.0 - haze) + haze;
  gl_FragColor = vec4(col / max(a, 1e-4), a);
}`;

// Aerial perspective: gentler exponential falloff with a cap, so distant ranges stay readable as
// shaded silhouettes in the haze instead of flat cut-outs. Replaces the built-in fog for all materials.
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = min(1.0 - exp(-fogDensity * 0.42 * vFogDepth), 0.9);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif`;

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(this.hemi);
    this.fog = new THREE.FogExp2(0xcccccc, 0.006);
    scene.fog = this.fog;
    this.sunDir = new THREE.Vector3();
    // cloud dome
    this.cloudUniforms = {
      uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uTint: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() }, uSkyAmb: { value: new THREE.Color() },
      uCover: { value: 0.5 }, uTime: { value: 0 }, uHaze: { value: 0.9 }, uCirrus: { value: 0.5 }, uDark: { value: 0 },
    };
    this.cloudGeo = new THREE.SphereGeometry(3000, 64, 32);
    this.clouds = new THREE.Mesh(this.cloudGeo, this._cloudMaterial(6));
    this.clouds.renderOrder = -1;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.preset = null;
    this.setShadowQuality('high');
  }

  _cloudMaterial(octaves) {
    return new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: CLOUD_FRAG.replace('${OCT}', String(octaves)),
    });
  }

  setShadowQuality(q) {
    // cloud detail follows graphics quality
    const oct = { low: 4, medium: 5, high: 6, ultra: 7 }[q] || 6;
    if (this.clouds && this.cloudOct !== oct) { this.clouds.material.dispose(); this.clouds.material = this._cloudMaterial(oct); this.cloudOct = oct; }
    const size = { low: 1024, medium: 2048, high: 2048, ultra: 4096 }[q] || 2048;
    this.shadowExtent = { low: 18, medium: 24, high: 28, ultra: 32 }[q] || 28;
    const s = this.sun.shadow;
    if (s.map) { s.map.dispose(); s.map = null; }
    s.mapSize.set(size, size);
    const c = s.camera;
    c.left = -this.shadowExtent; c.right = this.shadowExtent; c.top = this.shadowExtent; c.bottom = -this.shadowExtent;
    c.near = 1; c.far = 400; c.updateProjectionMatrix();
    this.renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  }

  apply(name, levelEnv = {}) {
    const p = PRESETS[name] || PRESETS.golden;
    this.preset = name; this.p = p;
    const phi = THREE.MathUtils.degToRad(90 - p.elev), theta = THREE.MathUtils.degToRad(p.azim + (levelEnv.azimOffset || 0));
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    const u = this.sky.material.uniforms;
    u.turbidity.value = p.turbidity; u.rayleigh.value = p.rayleigh; u.mieCoefficient.value = p.mie; u.mieDirectionalG.value = p.mieG;
    u.sunPosition.value.copy(this.sunDir);
    this.sun.color.set(p.sunColor); this.sun.intensity = p.sunI;
    this.hemi.color.set(p.hemiSky); this.hemi.groundColor.set(p.hemiGround); this.hemi.intensity = p.hemiI;
    const fogC = new THREE.Color(p.fog);
    if (levelEnv.dust) fogC.lerp(new THREE.Color(0xd9b68c), levelEnv.dust * 0.35);
    this.fog.color.copy(fogC); this.fog.density = p.fogD * (levelEnv.fogMul || 1);
    this.renderer.toneMappingExposure = p.exposure;
    this.sun.shadow.radius = p.shadowSoft;
    this.cloudUniforms.uSunDir.value.copy(this.sunDir);
    this.cloudUniforms.uSunCol.value.set(p.sunColor);
    this.cloudUniforms.uTint.value.set(p.cloudTint);
    this.cloudUniforms.uCover.value = p.clouds;
    this.cloudUniforms.uFog.value.copy(fogC);
    this.cloudUniforms.uSkyAmb.value.set(p.hemiSky);
    this.cloudUniforms.uHaze.value = p.haze ?? 0.9;
    this.cloudUniforms.uCirrus.value = p.cirrus ?? 0.5;
    this.cloudUniforms.uDark.value = p.dark ?? 0;
    sharedTerrainUniforms.uWet.value = Math.min(1, p.wet + (levelEnv.wetBias || 0));
    // environment map from sky (+clouds) for reflections / IBL
    const tmp = new THREE.Scene();
    const sky2 = new Sky(); sky2.scale.setScalar(1000);
    Object.keys(u).forEach((k) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value.clone ? u[k].value.clone() : u[k].value; });
    tmp.add(sky2);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.hemiGround).multiplyScalar(0.8) }));
    ground.position.y = -20; tmp.add(ground);
    const cloudsEnv = new THREE.Mesh(this.cloudGeo, this.clouds.material); tmp.add(cloudsEnv);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(tmp, 0.02, 1, 5000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.75;
    sky2.geometry.dispose(); sky2.material.dispose(); ground.geometry.dispose();
    return p;
  }

  update(dt, focus, time) {
    // shadow camera follows the focus (snapped to texels to avoid shimmering)
    const ext = this.shadowExtent * 2, texel = ext / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDir, 150);
    this.cloudUniforms.uTime.value = time;
    this.sky.position.copy(focus); this.clouds.position.set(focus.x, 0, focus.z);
  }
}
