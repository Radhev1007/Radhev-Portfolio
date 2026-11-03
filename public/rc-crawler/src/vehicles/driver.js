// The driver figure in the game: loaded once (assets/driver.glb), skinned to the skeleton in driverRig.js, and
// shared by every copy, each with its own bones. A copy either rides in a truck (drive: hands on the wheel,
// turning it as the truck steers, the body swaying with the corners and jolting over bumps, the head looking into
// turns) or walks on foot (walk).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { skinWeights, cullSeams, buildSkeleton, poseSeated, poseWalk, FIGURE } from './driverRig.js';

export const DRIVER_CREDIT = { title: 'Casual Confidence', author: 'restore50', changes: 'rigged, seated and animated in the game, simplified', url: 'https://sketchfab.com/3d-models/casual-confidence-cddbbc7660454ec9997cacb9ab6cf58d', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };

let shared = null;
/** Load and skin the figure once; resolves to { geometry, material } or null if it could not be loaded. */
export function loadDriver() {
  if (!shared) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    shared = loader.loadAsync(new URL('../../assets/driver.glb', import.meta.url).href).then((g) => {
      g.scene.updateMatrixWorld(true);
      let src = null; g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
      // plain float attributes in figure units (the file's are quantized under a node transform)
      const geo = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv']) {
        const a = src.geometry.getAttribute(name); if (!a) continue;
        const out = new Float32Array(a.count * a.itemSize);
        const get = [a.getX, a.getY, a.getZ, a.getW].slice(0, a.itemSize).map((f) => f.bind(a));   // (r160 has no getComponent)
        for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = get[k](i);
        geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
      }
      geo.applyMatrix4(src.matrixWorld);
      const w = skinWeights(geo.getAttribute('position').array);
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(w.index, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w.weight, 4));
      geo.setIndex(new THREE.BufferAttribute(cullSeams(src.geometry.index.array, w.group), 1));
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      const material = src.material;
      material.side = THREE.DoubleSide;   // (the cut pocket seams show the inside of the cloth)
      return { geometry: geo, material };
    }).catch((e) => { console.warn('[driver] model failed to load', e); return null; });
  }
  return shared;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _a = new THREE.Vector3();

export class DriverFigure {
  constructor({ geometry, material }) {
    this.rig = buildSkeleton();
    this.mesh = new THREE.SkinnedMesh(geometry, material);
    this.mesh.add(this.rig.root);
    this.mesh.bind(new THREE.Skeleton(this.rig.list));
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;   // (its bounds are the standing figure's; seated or walking it moves outside them)
    this.group = new THREE.Group(); this.group.name = 'Driver';
    this.group.add(this.mesh);
    // riding: the truck's motion felt in its own frame, smoothed (a little lag reads as weight)
    this.prev = null; this.vel = new THREE.Vector3(); this.lean = 0; this.bounce = 0; this.bounceV = 0; this.look = 0;
    poseSeated(this.rig, {});
  }

  /** Ride in the truck whose group is `truck`: state.steer (radians, left positive), state.dt. */
  drive(state, truck) {
    const dt = Math.max(1e-3, state.dt || 1 / 60);
    truck.getWorldPosition(_p); truck.getWorldQuaternion(_q);
    if (this.prev) {
      _v.copy(_p).sub(this.prev).divideScalar(dt);
      _a.copy(_v).sub(this.vel).divideScalar(dt).applyQuaternion(_q.invert());   // acceleration in the truck's frame
      this.vel.copy(_v);
    } else { this.prev = new THREE.Vector3(); _a.set(0, 0, 0); }
    this.prev.copy(_p);
    if (_a.lengthSq() > 2500) _a.setLength(50);   // a teleport (recovery, respawn) is not a jolt
    const k = Math.min(1, dt * 6);
    this.lean += (THREE.MathUtils.clamp(-_a.x * 0.06, -0.35, 0.35) - this.lean) * k;   // thrown out of the turn
    // the jolt: a spring pushed by vertical acceleration (a bump pushes him into the seat)
    this.bounceV += (THREE.MathUtils.clamp(_a.y * 0.4, -30, 30) - this.bounce * 60 - this.bounceV * 9) * dt;
    this.bounce = THREE.MathUtils.clamp(this.bounce + this.bounceV * dt, -1, 1);
    const steer = (state.steer || 0) / 0.58;
    this.look += (steer * 0.5 - this.look) * Math.min(1, dt * 4);   // looks where he is turning
    poseSeated(this.rig, { steer, lean: this.lean, bounce: this.bounce, look: this.look });
  }

  /** Walk with an OnFoot controller: placed on the ground at its position, facing its way. */
  walk(onFoot) {
    poseWalk(this.rig, onFoot.phase, onFoot.gait);
    this.group.position.set(onFoot.pos.x, onFoot.pos.y - FIGURE.footY * FIGURE.scale, onFoot.pos.z);
    this.group.rotation.set(0, onFoot.yaw, 0);
    this.group.scale.setScalar(FIGURE.scale);
    this.prev = null;
  }
}
