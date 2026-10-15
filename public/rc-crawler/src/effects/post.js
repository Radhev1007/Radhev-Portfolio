// Post stack: render -> depth of field (miniature focus) -> bloom -> tone map -> cinematic grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Removes NaN/Inf and clamps extreme HDR highlights (wet-surface sun glints) so bloom/DOF blurs
// can't smear invalid pixels into black blocks across the frame.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 48.0), 1.0);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uWarm: { value: 0.04 }, uContrast: { value: 1.08 }, uSat: { value: 1.0 }, uLift: { value: 0.0 },
    uVignette: { value: 0.32 }, uTime: { value: 0 }, uGrain: { value: 0.025 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uWarm, uContrast, uSat, uLift, uVignette, uTime, uGrain; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // split toning: warm highlights, cool-teal shadows
      vec3 sh = vec3(-0.012, 0.004, 0.02), hi = vec3(0.03, 0.008, -0.03);
      c += mix(sh, hi * (1.0 + uWarm * 8.0), smoothstep(0.15, 0.85, l)) * (0.6 + uWarm * 4.0);
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5 + uLift;
      // gentle filmic shoulder
      c = clamp(c, 0.0, 1.0);
      vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
      c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(d));
      c += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.build(quality);
  }

  build(quality) {
    this.quality = quality;
    if (this.composer) this.composer.dispose?.();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === 'low' ? 0 : 4 });
    const c = new EffectComposer(this.renderer, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    c.addPass(new ShaderPass(SanitizeShader));
    this.bokeh = null;
    if (quality === 'high' || quality === 'ultra' || quality === 'medium') {
      this.bokeh = new BokehPass(this.scene, this.camera, { focus: 4, aperture: 0.002, maxblur: 0.004 });
      c.addPass(this.bokeh);
    }
    this.bloom = null;
    if (quality !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.6, 0.92);
      c.addPass(this.bloom);
    }
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    this.composer = c;
    this.dofStrength = 0.4;
  }

  setGrade(g) {
    const u = this.grade.uniforms;
    u.uWarm.value = g.warm; u.uContrast.value = g.contrast; u.uSat.value = g.sat; u.uLift.value = g.lift;
  }

  // dof: 0 off .. 1 strong (intro/cinematic)
  setDOF(focus, amount) {
    if (!this.bokeh) return;
    this.dofStrength += (amount - this.dofStrength) * 0.05;
    const u = this.bokeh.uniforms;
    u.focus.value = focus;
    u.aperture.value = 0.0006 + this.dofStrength * 0.004;
    u.maxblur.value = 0.0025 + this.dofStrength * 0.008;
    this.bokeh.enabled = this.dofStrength > 0.03;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.grade.uniforms.uRes.value.set(w, h);
  }

  render(dt) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}
