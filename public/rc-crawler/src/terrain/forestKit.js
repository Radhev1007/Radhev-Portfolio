// Forest kit: trees, plants and a log from real models (assets/forest/kit.glb, made by tools/rc-forest.mjs from
// "a forest (3) with a road at night for game" by dasy444 and "Logs" by Kathrin&Christian, both CC BY 4.0).
// Vegetation.build() instances these in place of its procedural pines, bushes, grass and logs.
//
// Each part comes as plain float geometry, standing on the origin and 1 unit tall (the log: lying along X,
// 1 unit long, centred), with the model's own material.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const FOREST_PARTS = ['pine', 'slim', 'fir', 'bush', 'tuft', 'log'];
let kit = null;

export function loadForestKit() {
  if (!kit) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    kit = loader.loadAsync(new URL('../../assets/forest/kit.glb', import.meta.url).href).then(toParts).catch((e) => {
      console.warn('[forest] kit not loaded, keeping the procedural vegetation', e);
      kit = null;
      return null;
    });
  }
  return kit;
}

// compressed attributes (quantized ints) as plain floats, so the geometry can be transformed and merged freely
function toFloat(g) {
  for (const [name, a] of Object.entries(g.attributes)) {
    if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent ? a.getComponent(i, k) : [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)][k];
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

function toParts(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const parts = {};
  for (const name of FOREST_PARTS) {
    const holder = gltf.scene.getObjectByName(name);
    if (!holder) throw new Error(`forest kit has no ${name}`);
    const list = [];
    holder.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = toFloat(o.geometry.clone()).applyMatrix4(o.matrixWorld);   // the node transforms undo the compression
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const material = o.material;
      material.side = THREE.DoubleSide;
      if (material.alphaTest > 0 || material.transparent) { material.transparent = false; material.alphaTest = 0.5; }
      list.push({ geometry, material });
    });
    if (name === 'log') {   // centre the log on its axis: it is placed like the game's own logs
      const box = new THREE.Box3();
      for (const p of list) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
      const c = box.getCenter(new THREE.Vector3());
      for (const p of list) p.geometry.translate(-c.x, -c.y, -c.z);
      // its radius as the eye reads it: most of the surface (80th percentile), not knots and branch stubs
      const d = [];
      for (const p of list) { const a = p.geometry.attributes.position; for (let i = 0; i < a.count; i++) d.push(Math.hypot(a.getY(i), a.getZ(i))); }
      d.sort((x, y) => x - y);
      list.radius = d[Math.floor(d.length * 0.8)];
    }
    for (const p of list) p.geometry.computeBoundingSphere();
    parts[name] = list;
  }
  return parts;
}
