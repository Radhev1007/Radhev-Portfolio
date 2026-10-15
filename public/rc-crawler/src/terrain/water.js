// Shallow water: depth-aware transparency, flowing normals, fresnel sky reflections, shoreline foam.
import * as THREE from 'three';

export const waterUniforms = { uTime: { value: 0 } };

let normalTex = null;
function getWaterNormal() {
  if (normalTex) return normalTex;
  const S = 256, data = new Uint8Array(S * S * 4);
  // sum of periodic waves -> height -> normal
  const H = new Float32Array(S * S);
  const waves = [];
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 24; i++) waves.push({ kx: Math.round((rnd() - 0.5) * 16), ky: Math.round((rnd() - 0.5) * 16), a: 0.4 + rnd(), p: rnd() * 6.28 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const w of waves) h += Math.sin(((x * w.kx + y * w.ky) / S) * Math.PI * 2 + w.p) * w.a / (1 + Math.hypot(w.kx, w.ky) * 0.2);
    H[y * S + x] = h;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = H[y * S + ((x + 1) % S)] - H[y * S + ((x - 1 + S) % S)];
    const dy = H[((y + 1) % S) * S + x] - H[((y - 1 + S) % S) * S + x];
    const nx = -dx * 0.6, ny = -dy * 0.6, nz = 1, l = Math.hypot(nx, ny, nz);
    const o = (y * S + x) * 4;
    data[o] = (nx / l * 0.5 + 0.5) * 255; data[o + 1] = (ny / l * 0.5 + 0.5) * 255; data[o + 2] = (nz / l * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  normalTex = new THREE.DataTexture(data, S, S);
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.generateMipmaps = true; normalTex.minFilter = THREE.LinearMipmapLinearFilter; normalTex.magFilter = THREE.LinearFilter;
  normalTex.needsUpdate = true;
  return normalTex;
}

// body: { x0, z0, x1, z1, y, flow:[fx,fz], murky, path? (creek centre-line for a flow field), width? }
// Shading model: the surface is mostly see-through looking down (light absorbed with path length through
// the water, so shallow beds show clearly and deep pools tint green), and mostly mirror at grazing angles
// (Fresnel). Body colour is premultiplied by the absorption alpha; reflections are added on top unscaled.
export function createWaterMesh(hf, body, cell = 0.25) {
  const w = body.x1 - body.x0, d = body.z1 - body.z0;
  const nx = Math.max(2, Math.round(w / cell)), nz = Math.max(2, Math.round(d / cell));
  const g = new THREE.PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((body.x0 + body.x1) / 2, body.y, (body.z0 + body.z1) / 2);
  const p = g.attributes.position;
  const depth = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    depth[i] = body.y - hf.heightAt(p.getX(i), p.getZ(i));
    // puddles are confined to their pit: treat everything outside the radius as dry ground
    if (body.mask && !body.mask(p.getX(i), p.getZ(i))) depth[i] = Math.min(depth[i], -0.1);
  }
  g.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  // drop triangles fully above ground
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (depth[a] > -0.08 || depth[b] > -0.08 || depth[c] > -0.08) keep.push(a, b, c);
  }
  g.setIndex(keep);
  // per-vertex flow field: follow the creek centre-line, faster mid-channel, slack at the edges
  const flow = new Float32Array(p.count * 2);
  const f0 = body.flow || [0.25, 0];
  if (body.path) {
    const pts = body.path.pts, tan = body.path.tan, halfW = body.width || 3;
    for (let i = 0; i < p.count; i++) {
      if (depth[i] < -0.08) continue;
      const x = p.getX(i), z = p.getZ(i);
      let best = 0, bd = 1e9;
      for (let k = 0; k < pts.length; k += 2) { const dd = (pts[k].x - x) ** 2 + (pts[k].z - z) ** 2; if (dd < bd) { bd = dd; best = k; } }
      const dist = Math.sqrt(bd);
      const speed = Math.hypot(f0[0], f0[1]) * (0.35 + 0.9 * Math.max(0, 1 - dist / (halfW * 1.4)));
      const dir = Math.sign(f0[0] * tan[best].x + f0[1] * tan[best].z) || 1;
      flow[i * 2] = tan[best].x * speed * dir; flow[i * 2 + 1] = tan[best].z * speed * dir;
    }
  } else for (let i = 0; i < p.count; i++) { flow[i * 2] = f0[0]; flow[i * 2 + 1] = f0[1]; }
  g.setAttribute('aFlow', new THREE.BufferAttribute(flow, 2));

  const murky = !!body.murky;
  const mat = new THREE.MeshStandardMaterial({
    color: murky ? 0x2a1d10 : 0x0c1d1a, roughness: murky ? 0.12 : 0.06, metalness: 0.0,
    transparent: true, premultipliedAlpha: true, depthWrite: false, envMapIntensity: 1.0,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterUniforms.uTime;
    sh.uniforms.uNrm = { value: getWaterNormal() };
    sh.uniforms.uMurky = { value: murky ? 1 : 0 };
    sh.uniforms.uSurround = { value: new THREE.Color(body.surround ?? 0x2e3524) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nattribute vec2 aFlow;\nvarying float vDepth;\nvarying vec2 vFlow;\nvarying vec3 vWP;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvDepth = aDepth; vFlow = aFlow; vWP = (modelMatrix * vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; uniform sampler2D uNrm; uniform float uMurky; uniform vec3 uSurround;
        varying float vDepth; varying vec2 vFlow; varying vec3 vWP;
        vec3 wN; float wAlpha; float wFoam;
        float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(wh(i),wh(i+vec2(1,0)),f.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x), f.y); }
        // flow-mapped normal sample: two phase-offset layers cross-faded so the texture never stretches
        vec2 flowN(vec2 uv, vec2 flow, float scale, float speed){
          float t = uTime * speed;
          float p0 = fract(t), p1 = fract(t + 0.5);
          float k = abs(p0 - 0.5) * 2.0;
          vec2 a = texture2D(uNrm, uv * scale - flow * p0 * 1.6).xy * 2. - 1.;
          vec2 b = texture2D(uNrm, uv * scale + 0.37 - flow * p1 * 1.6).xy * 2. - 1.;
          return mix(a, b, k);
        }`)
      .replace('#include <map_fragment>', /* glsl */`
        vec2 fl = vFlow;
        float fs = length(fl);
        vec2 nA = flowN(vWP.xz, fl * 2.2, 0.32, 0.22);
        vec2 nB = flowN(vWP.xz + 3.1, fl * 3.0, 0.95, 0.31);
        vec2 nC = texture2D(uNrm, vWP.xz * 0.11 + vec2(uTime * 0.006, -uTime * 0.004)).xy * 2. - 1.;
        float rough = mix(0.45, 1.0, clamp(fs * 2.5, 0., 1.));          // faster water = choppier
        vec2 nn = (nA * 0.7 + nB * 0.45 * rough + nC * 0.25) * (uMurky > 0.5 ? 0.025 : 0.33);
        wN = normalize(vec3(nn.x, 1.0, nn.y));
        float dep = max(vDepth, 0.0);
        // light path through the water to the bed and back toward the eye
        vec3 V = normalize(cameraPosition - vWP);
        float path = dep / max(0.12, V.y);
        float k = uMurky > 0.5 ? 22.0 : 1.15;
        float absorb = 1.0 - exp(-path * k);
        // foam: patchy streaks advected downstream over shallows and around rocks, thin line at the shore
        float fn = wn(vWP.xz * 3.2 - fl * uTime * 3.0) * 0.6 + wn(vWP.xz * 7.0 - fl * uTime * 4.5) * 0.4;
        float shallow = 1.0 - smoothstep(0.02, 0.16, dep);
        wFoam = smoothstep(0.55, 0.85, fn) * shallow * (0.35 + fs * 1.5) + smoothstep(0.03, 0.0, dep) * 0.35 * fn;
        wFoam = clamp(wFoam * (1.0 - uMurky * 0.7), 0.0, 0.8);
        // soft edge where the surface meets the bank
        float edge = smoothstep(-0.01, 0.05, vDepth);
        wAlpha = clamp(max(absorb, wFoam), 0.0, 1.0) * edge;
        // body colour (in-scattered light): teal-green clear water, brown murky water
        vec3 body = uMurky > 0.5 ? vec3(0.17, 0.12, 0.07) : mix(vec3(0.09, 0.12, 0.08), vec3(0.03, 0.06, 0.05), smoothstep(0.1, 0.6, dep));
        diffuseColor.rgb = mix(body, vec3(0.82, 0.85, 0.83), wFoam);
        diffuseColor.a = 1.0;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.6, wFoam);')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);')
      // premultiplied output: absorbed body colour scaled by alpha, reflections (Fresnel already in the BRDF) kept whole
      .replace('#include <opaque_fragment>', /* glsl */`
        float specMask = smoothstep(-0.01, 0.05, vDepth);
        // the env map only holds sky; low reflection angles would really mirror the banks and trees,
        // so fade those reflections toward the surroundings' colour (sky stays for steeper angles)
        vec3 Vw = normalize(cameraPosition - vWP);
        vec3 Rw = reflect(-Vw, wN);
        float skyAmt = smoothstep(0.08, 0.55, Rw.y) * (1.0 - uMurky * 0.45);
        vec3 indSpec = reflectedLight.indirectSpecular * mix(uSurround, vec3(1.0), skyAmt);
        vec3 spec = (reflectedLight.directSpecular + indSpec) * specMask * (1.0 - wFoam * 0.6);
        gl_FragColor = vec4(totalDiffuse * wAlpha + spec, clamp(wAlpha + dot(spec, vec3(0.3, 0.5, 0.2)) * 0.2, 0.0, 1.0));
      `)
      .replace('#include <premultiplied_alpha_fragment>', '')
      .replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = min(1.0 - exp(-fogDensity * 0.42 * vFogDepth), 0.9);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * gl_FragColor.a, fogFactor);
        #endif`);
  };
  mat.customProgramCacheKey = () => 'water-v3';
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return mesh;
}

// vertical falling-water sheet (decorative waterfall)
export function createWaterfall(x, y0, y1, z, width, yaw) {
  const g = new THREE.PlaneGeometry(width, y0 - y1, 8, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + (y0 - y1) / 2) / (y0 - y1); // 1 top .. 0 bottom
    p.setZ(i, Math.pow(1 - t, 2) * 0.8 + Math.sin(p.getX(i) * 3) * 0.08);
  }
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = vec2(vUv.x * 6., vUv.y * 3. + uTime * 2.2);
        float s = n(uv * vec2(3., 1.)) * 0.6 + n(uv * vec2(9., 2.5)) * 0.4;
        float streak = smoothstep(0.35, 0.85, s);
        float edge = smoothstep(0., 0.12, vUv.x) * smoothstep(1., 0.88, vUv.x);
        float a = (0.35 + streak * 0.6) * edge;
        vec3 c = mix(vec3(0.32, 0.38, 0.36), vec3(0.62, 0.66, 0.64), streak);
        gl_FragColor = vec4(c, a * 0.75);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, (y0 + y1) / 2, z);
  m.rotation.y = yaw;
  m.renderOrder = 3;
  return m;
}
