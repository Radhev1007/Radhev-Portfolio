// Soft ambient-occlusion blob under the chassis + per-tyre contact darkening, conformed to the terrain.
import * as THREE from 'three';

function blobTexture() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class ContactShadow {
  constructor() {
    const tex = blobTexture();
    this.mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tex, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -8 });
    this.body = this._grid(0.95, 1.8, 20, 36);   // finer grid so sand ripples can't poke through
    this.wheels = [0, 1, 2, 3].map(() => this._grid(0.26, 0.36, 6, 8));
    this.group = new THREE.Group();
    this.group.add(this.body.mesh, ...this.wheels.map((w) => w.mesh));
    this.wheelMat = this.mat.clone(); this.wheelMat.opacity = 0.7;
    this.wheels.forEach((w) => (w.mesh.material = this.wheelMat));
  }

  _grid(w, l, nx, nz) {
    const g = new THREE.PlaneGeometry(w, l, nx, nz);
    g.rotateX(-Math.PI / 2);
    const local = g.attributes.position.array.slice();
    const mesh = new THREE.Mesh(g, this.mat);
    mesh.frustumCulled = false; mesh.renderOrder = 1;
    return { g, local, mesh };
  }

  _conform(grid, cx, cz, yaw, hf, lift, fade) {
    const p = grid.g.attributes.position.array, L = grid.local;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < p.length; i += 3) {
      const lx = L[i], lz = L[i + 2];
      const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
      p[i] = x; p[i + 1] = hf.heightAt(x, z) + lift; p[i + 2] = z;
    }
    grid.g.attributes.position.needsUpdate = true;
    grid.mesh.visible = fade > 0.02;
  }

  update(phys, hf) {
    const yaw = phys.yaw;
    const h = phys.pos.y - hf.heightAt(phys.pos.x, phys.pos.z);
    const up = phys.up.y;
    const fade = THREE.MathUtils.clamp(1.4 - h * 1.2, 0, 1) * THREE.MathUtils.clamp(up * 1.5 - 0.3, 0, 1);
    this.mat.opacity = 0.28 * fade;
    this._conform(this.body, phys.pos.x, phys.pos.z, yaw, hf, 0.032, fade);
    let any = 0;
    phys.wheels.forEach((w, i) => {
      if (w.contact && w.cp) { this._conform(this.wheels[i], w.cp.x, w.cp.z, yaw, hf, 0.03, 1); any++; }
      else this.wheels[i].mesh.visible = false;
    });
    this.wheelMat.opacity = 0.14 * Math.min(1, fade + 0.3);
  }
}
