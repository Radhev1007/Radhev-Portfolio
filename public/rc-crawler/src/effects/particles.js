// Soft-sprite particle pool for dust, mud flicks, water splashes and gravel.
import * as THREE from 'three';

export class Particles {
  constructor(max = 1200) {
    this.max = max;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.cursor = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 } },
      vertexShader: /* glsl */`
        attribute vec4 aColor; attribute float aSize; uniform float uScale; varying vec4 vC; varying float vFog;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; vFog = -mv.z; }`,
      fragmentShader: /* glsl */`
        varying vec4 vC; varying float vFog; uniform vec3 fogColor; uniform float fogDensity;
        void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard;
          float a = smoothstep(.5, .0, r); a *= a;
          float f = min(1.0 - exp(-fogDensity * 0.42 * vFog), 0.9);
          gl_FragColor = vec4(mix(vC.rgb, fogColor, f), vC.a * a); }`,
    });
    this.material = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.geo = g;
    for (let i = 0; i < max; i++) this.life[i] = 0;
  }

  emit(p, v, color, o = {}) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 4] = color.r; this.col[i * 4 + 1] = color.g; this.col[i * 4 + 2] = color.b;
    this.alpha0[i] = o.alpha ?? 0.5;
    this.size[i] = o.size ?? 0.15;
    this.grow[i] = o.grow ?? 0.4;
    this.life[i] = this.maxLife[i] = o.life ?? 1.2;
    this.grav[i] = o.grav ?? 2;
    this.drag[i] = o.drag ?? 1.5;
  }

  update(dt, fog) {
    if (fog) { this.material.uniforms.fogColor.value.copy(fog.color); this.material.uniforms.fogDensity.value = fog.density; }
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4 + 3] = this.alpha0[i] * Math.min(1, t * 8) * (1 - t);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  setPixelScale(h) { this.material.uniforms.uScale.value = h * 0.9; }
}
