// Splat-blended, height-aware terrain material + triplanar rock material (MeshStandardMaterial with injected GLSL).
import * as THREE from 'three';
import { getTerrainTextures } from './textures.js';

export const sharedTerrainUniforms = {
  uWet: { value: 0 },          // global wetness (after rain)
  uWaterY: { value: -1e4 },    // water level for shoreline darkening
  uTime: { value: 0 },
  uDust: { value: 0 },         // global dust tint (desert)
  uMossAmt: { value: 0.6 },    // moss on rock tops
  uTopLayer: { value: 5 },     // layer used on rock tops (5 forest moss / 3 sand / 1 dirt)
  uSnowLine: { value: 1e4 },
  uCaustic: { value: 1 },       // caustic strength (sunny presets high, overcast low)
  uSurround: { value: new THREE.Color(0x3a3a30) }, // what low-angle reflections would really see (ground/trees)
};

const COMMON = /* glsl */`
precision highp sampler2DArray;
#ifndef TRI_SHARP
#define TRI_SHARP 4.0
#endif
uniform sampler2DArray uAlb;
uniform sampler2DArray uNor;
uniform float uWet;
uniform float uWaterY;
uniform float uDust;
uniform float uMossAmt;
uniform float uTopLayer;
uniform float uSnowLine;
uniform float uTime;
uniform float uCaustic;
uniform vec3 uSurround;
varying vec3 vWPos;
varying vec3 vWN;
vec3 gWorldN;
float gRough;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x), f.y); }

// Planar (xz) sample with cheap anti-tiling: two rotated/offset samples blended by low-freq noise
void sampleXZ(float L, vec2 uv, out vec4 a, out vec4 n){
  float m = vnoise(uv * 0.23 + L * 7.1);
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.71 + vec2(0.37, 0.71);
  vec4 a1 = texture(uAlb, vec3(uv, L)), a2 = texture(uAlb, vec3(uv2, L));
  vec4 n1 = texture(uNor, vec3(uv, L)), n2 = texture(uNor, vec3(uv2, L));
  float t = smoothstep(0.35, 0.65, m);
  a = mix(a1, a2, t); n = mix(n1, n2, t);
}

// Triplanar sample, returns albedo/rough and world-space normal perturbation in n.xyz, height in n.w
void sampleTri(float L, vec3 p, vec3 N, float s, out vec4 a, out vec4 nOut){
  vec3 bw = pow(abs(N), vec3(TRI_SHARP)); bw /= (bw.x + bw.y + bw.z);
  vec4 ax = texture(uAlb, vec3(p.zy * s, L)), ay = texture(uAlb, vec3(p.xz * s, L)), az = texture(uAlb, vec3(p.xy * s, L));
  vec4 nx = texture(uNor, vec3(p.zy * s, L)), ny = texture(uNor, vec3(p.xz * s, L)), nz = texture(uNor, vec3(p.xy * s, L));
  a = ax * bw.x + ay * bw.y + az * bw.z;
  vec2 tx = nx.xy * 2. - 1., ty = ny.xy * 2. - 1., tz = nz.xy * 2. - 1.;
  vec3 d = bw.x * vec3(0., tx.y, tx.x) * sign(N.x) + bw.y * vec3(ty.x, 0., ty.y) + bw.z * vec3(tz.x, tz.y, 0.) * sign(N.z);
  nOut = vec4(d, nx.z * bw.x + ny.z * bw.y + nz.z * bw.z);
}

// animated sunlight caustics (tileable turbulence pattern)
float causticPat(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 2.0);
}
// underwater: bed tinted & darkened with depth, lit by moving caustics
vec3 underwater(vec3 col, vec3 P){
  float d = uWaterY - P.y;
  if (d <= 0.0) return col;
  float inW = smoothstep(0.0, 0.05, d);
  float c = causticPat(P.xz * 0.28, uTime * 0.55) * 0.6 + causticPat(P.xz * 0.5 + 1.7, uTime * 0.7) * 0.4;
  col *= mix(vec3(1.0), vec3(0.72, 0.86, 0.82), inW * smoothstep(0.0, 0.5, d));
  col *= 1.0 + c * uCaustic * 0.9 * inW * exp(-d * 1.8);
  return col;
}
vec3 applyWet(vec3 col, inout float rough, float wet){
  col *= mix(1.0, 0.6, wet);
  rough = mix(rough, 0.3, wet * 0.85);
  return col;
}
`;


const REFLECT_FIX = /* glsl */`
  {
    // the env map only contains sky: fade grazing reflections toward the surroundings' colour
    vec3 Vw_ = normalize(cameraPosition - vWPos);
    vec3 Rw_ = reflect(-Vw_, gWorldN);
    float sky_ = smoothstep(-0.05, 0.5, Rw_.y);
    outgoingLight = totalDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular * mix(uSurround, vec3(1.0), sky_) + totalEmissiveRadiance;
  }
  #include <opaque_fragment>`;

function baseMat(params) {
  const tex = getTerrainTextures(params.quality);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 1.0 });
  mat.userData.tex = tex;
  return { mat, tex };
}

const VERT_PRE = /* glsl */`
varying vec3 vWPos;
varying vec3 vWN;
`;
const VERT_MAIN = /* glsl */`
  vec4 wp4 = vec4(transformed, 1.0);
  vec3 on = objectNormal;
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
    on = mat3(instanceMatrix) * on;
  #endif
  wp4 = modelMatrix * wp4;
  vWPos = wp4.xyz;
  vWN = normalize(mat3(modelMatrix) * on);
`;

export function createTerrainMaterial(params = {}) {
  const { mat, tex } = baseMat(params);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAlb = { value: tex.albedo };
    sh.uniforms.uNor = { value: tex.normal };
    Object.assign(sh.uniforms, sharedTerrainUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PRE + 'attribute vec4 aSplatA;\nattribute vec4 aSplatB;\nvarying vec4 vSA;\nvarying vec4 vSB;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + VERT_MAIN + 'vSA = aSplatA; vSB = aSplatB;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n#define TRI_SHARP 2.0\n' + COMMON + 'varying vec4 vSA;\nvarying vec4 vSB;')
      .replace('#include <map_fragment>', /* glsl */`
      {
        vec3 P = vWPos; vec3 N = normalize(vWN);
        float W[7];
        W[0] = vSA.x; W[1] = vSA.y; W[2] = vSA.z; W[3] = vSA.w; W[4] = vSB.x; W[5] = vSB.y; W[6] = vSB.z;
        // slope pushes towards rock
        float slope = 1.0 - N.y;
        W[0] = max(W[0], smoothstep(0.32, 0.55, slope));
        float SC[7]; SC[0]=0.24; SC[1]=0.55; SC[2]=0.7; SC[3]=0.3; SC[4]=0.45; SC[5]=0.5; SC[6]=0.85;
        vec3 col = vec3(0.); float rough = 0.; vec3 dn = vec3(0.); float tot = 0.;
        float macro = vnoise(P.xz * 0.045) * 0.6 + vnoise(P.xz * 0.21) * 0.4;
        for (int i = 0; i < 7; i++) {
          float w = W[i];
          if (w < 0.015) continue;
          vec4 a, n;
          if (i == 0) {
            sampleTri(0.0, P, N, SC[0], a, n);
            float hb = n.w;
            float ww = w * (0.35 + hb) ; ww = ww * ww;
            col += a.rgb * ww; rough += a.a * ww; dn += n.xyz * 1.4 * ww; tot += ww;
          } else {
            sampleXZ(float(i), P.xz * SC[i], a, n);
            float ww = w * (0.35 + n.z); ww = ww * ww;
            vec2 t = n.xy * 2. - 1.;
            col += a.rgb * ww; rough += a.a * ww; dn += vec3(t.x, 0., t.y) * ww; tot += ww;
          }
        }
        col /= max(tot, 1e-4); rough /= max(tot, 1e-4); dn /= max(tot, 1e-4);
        col *= mix(0.82, 1.12, macro);
        // dust (dry) and shoreline / global wetness
        { float lum = dot(col, vec3(0.3, 0.55, 0.15)); col = mix(col, vec3(0.78, 0.62, 0.44) * (0.45 + lum * 1.1), uDust * 0.55 * (1.0 - W[0] * 0.6)); }
        float shore = 1.0 - smoothstep(uWaterY - 0.05, uWaterY + 0.45, P.y);
        float wet = clamp(max(uWet * (0.55 + 0.45 * macro), max(shore, vSB.w)), 0., 1.);
        // puddles: flat low spots when wet
        float puddle = uWet * smoothstep(0.55, 0.85, vSB.w + vnoise(P.xz * 0.6) * 0.5) * smoothstep(0.96, 0.995, N.y);
        col = applyWet(col, rough, wet);
        col = mix(col, col * 0.55, puddle); rough = mix(rough, 0.18, puddle);
        col = underwater(col, P);
        dn *= 1.0 - puddle;
        // snow on high ground (backdrop mountains)
        float snow = smoothstep(uSnowLine, uSnowLine + 6.0, P.y + vnoise(P.xz * 0.05) * 8.0) * smoothstep(0.35, 0.75, N.y);
        col = mix(col, vec3(0.93, 0.95, 1.0), snow); rough = mix(rough, 0.55, snow);
        gWorldN = normalize(N + dn * (1.0 - snow * 0.7));
        gRough = rough;
        diffuseColor.rgb *= col;
      }
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = max(gRough, 0.08);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gWorldN, 0.0)).xyz);')
      .replace('#include <opaque_fragment>', REFLECT_FIX);
  };
  mat.customProgramCacheKey = () => 'terrain-v3';
  return mat;
}

// Rock material for instanced rock meshes: triplanar rock + moss/sand on top + wetness + per-instance tint
export function createRockMaterial(params = {}) {
  const { mat, tex } = baseMat(params);
  mat.vertexColors = true; // baked cavity / edge-wear / base grime (multiplied with instance tint)
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAlb = { value: tex.albedo };
    sh.uniforms.uNor = { value: tex.normal };
    Object.assign(sh.uniforms, sharedTerrainUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PRE + 'varying float vLocalY;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + VERT_MAIN + 'vLocalY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON + 'varying float vLocalY;')
      .replace('#include <map_fragment>', /* glsl */`
      {
        vec3 P = vWPos; vec3 N = normalize(vWN);
        vec4 a, n;
        sampleTri(0.0, P, N, 0.34, a, n);
        vec4 a2, n2;
        sampleTri(0.0, P * 0.23 + 3.7, N, 0.34, a2, n2);
        vec4 a3, n3;
        sampleTri(0.0, P * 2.1 + 1.3, N, 0.34, a3, n3);   // close-up micro grain
        vec3 col = mix(a.rgb, a2.rgb, 0.4);
        col *= mix(0.9, 1.1, a3.r * 1.6);
        float rough = a.a;
        vec3 dn = n.xyz * 1.5 + n2.xyz * 0.9 + n3.xyz * 0.5;
        // large-scale colour drift across a rock face (iron/oxide warmth, cooler patches)
        float drift = vnoise(P.xz * 0.11 + P.y * 0.07);
        col *= mix(vec3(0.9, 0.92, 0.96), vec3(1.08, 1.0, 0.9), drift);
        // dark weathering streaks running down steep faces (water / desert varnish)
        float vert = 1.0 - abs(N.y);
        float streak = smoothstep(0.55, 0.9, vnoise(vec2(dot(P.xz, vec2(2.3, 1.9)), P.y * 0.3)));
        streak *= smoothstep(0.35, 0.8, vert);
        col *= 1.0 - streak * 0.38;
        // moss / sand settling on upward faces
        float top = smoothstep(0.5, 0.88, N.y + (vnoise(P.xz * 1.7) - 0.5) * 0.5 + (n.w - 0.5) * 0.6);
        top *= uMossAmt;
        vec4 ma, mn;
        sampleXZ(uTopLayer, P.xz * 0.6, ma, mn);
        col = mix(col, ma.rgb * (uTopLayer > 4.5 ? vec3(0.7, 1.05, 0.55) : vec3(1.0)), top);
        rough = mix(rough, ma.a, top);
        // soil grime where the rock enters the ground
        float grime = 1.0 - smoothstep(-0.36, -0.08, vLocalY);
        col = mix(col, col * vec3(0.66, 0.6, 0.52) + vec3(0.02, 0.015, 0.01), grime * 0.5);
        // darker micro-crevices from height
        col *= mix(0.72, 1.08, n.w);
        col = mix(col, col * vec3(1.1, 1.0, 0.85) + 0.02, uDust * 0.4);
        float shore = 1.0 - smoothstep(uWaterY - 0.05, uWaterY + 0.35, P.y);
        float wet = clamp(max(uWet * 0.85, shore), 0., 1.);
        col = applyWet(col, rough, wet);
        col = underwater(col, P);
        float snow = smoothstep(uSnowLine, uSnowLine + 6.0, P.y) * smoothstep(0.4, 0.8, N.y);
        col = mix(col, vec3(0.93, 0.95, 1.0), snow);
        gWorldN = normalize(N + dn * (1.0 - top * 0.5));
        gRough = rough;
        diffuseColor.rgb *= col;
      }
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = max(gRough, 0.08);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gWorldN, 0.0)).xyz);')
      .replace('#include <opaque_fragment>', REFLECT_FIX);
  };
  mat.customProgramCacheKey = () => 'rock-v4';
  return mat;
}
