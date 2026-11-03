// Falling rain: streaks in a box that travels with the camera, slanted by the wind. Each drop falls, and on
// reaching the bottom of the box (or leaving it sideways as the camera moves) it is put back at the top
// somewhere new, so the box is always full. One LineSegments, positions rewritten every frame.
import * as THREE from 'three';

const FALL = 11;       // units/s
const STREAK = 0.32;   // streak length (motion blur of a falling drop)

export class Rain {
  constructor(scene, count = 3200) {
    this.half = 12; this.height = 9;   // box half width and height above the camera
    this.count = count;
    this.drops = new Float32Array(count * 3);   // x, y, z of each drop's head
    this.positions = new Float32Array(count * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb9c4cf, transparent: true, opacity: 0.32, depthWrite: false }));
    this.lines.frustumCulled = false; this.lines.visible = false; this.lines.renderOrder = 3;
    scene.add(this.lines);
    this.intensity = 0; this.seeded = false;
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v || 0)); }

  _respawn(i, c, anyHeight) {
    const d = this.drops;
    d[i * 3] = c.x + (Math.random() * 2 - 1) * this.half;
    d[i * 3 + 1] = c.y + (anyHeight ? Math.random() * 2 - 1 : 1) * (this.height - STREAK - 0.02);   // (its whole streak inside the box)
    d[i * 3 + 2] = c.z + (Math.random() * 2 - 1) * this.half;
  }

  /** wind: sideways drift (units/s) along +x */
  update(dt, cam, wind = 0) {
    this.lines.visible = this.intensity > 0.01;
    if (!this.lines.visible) { this.seeded = false; return; }
    const n = Math.round(this.count * this.intensity), d = this.drops, p = this.positions;
    if (!this.seeded) { for (let i = 0; i < this.count; i++) this._respawn(i, cam, true); this.seeded = true; }
    const sx = wind / FALL;   // streak slant: horizontal per unit of fall
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      if (i >= n) { p.fill(0, i * 6, i * 6 + 6); continue; }   // (lighter rain: fewer drops drawn)
      d[k] += wind * dt; d[k + 1] -= FALL * dt;
      if (d[k + 1] < cam.y - this.height || Math.abs(d[k] - cam.x) > this.half || Math.abs(d[k + 2] - cam.z) > this.half) this._respawn(i, cam, false);
      // the streak: from its head up and upwind along its fall
      p[i * 6] = d[k] - sx * STREAK; p[i * 6 + 1] = d[k + 1] + STREAK; p[i * 6 + 2] = d[k + 2];
      p[i * 6 + 3] = d[k]; p[i * 6 + 4] = d[k + 1]; p[i * 6 + 5] = d[k + 2];
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.material.opacity = 0.18 + 0.2 * this.intensity;
  }
}
