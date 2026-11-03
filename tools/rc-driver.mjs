// RC Crawler driver: turn "Casual Confidence" (restore50, CC BY 4.0; a standing figure, hands in pockets, no
// skeleton) into a seated driver for the open Willys (public/rc-crawler/assets/driver.glb, seated by
// public/rc-crawler/src/vehicles/bodies.js).
//
// The figure has no rig, so it is seated by bending the mesh itself: the legs swing forward about the hip line
// and the shins fold back about the knee line, each blended over a band so the cloth bends instead of tearing;
// the torso leans back into the seat. Then it is simplified (keeping its UVs), its textures go to WebP and its
// geometry is meshopt-compressed.
//
//   npm i --prefix /tmp/rc-bodies @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 \
//     @gltf-transform/functions@4.5.1 meshoptimizer@0.21.0 sharp@0.35.5
//   RC_BODIES_DEPS=/tmp/rc-bodies node tools/rc-driver.mjs ~/Downloads/casual_confidence.glb \
//     public/rc-crawler/assets/driver.glb
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const req = createRequire(resolve(process.env.RC_BODIES_DEPS || '.', 'index.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { flatten, join, weld, dedup, prune, textureCompress, meshopt, quantize, getBounds, simplify } = req('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');

const [inFile, outFile, targetArg] = process.argv.slice(2);
const target = +targetArg || 14000;
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inFile);
const root = doc.getRoot();

// only its colour map is kept (UV set 0). Its roughness, normal and (empty) emissive maps each use another UV set;
// at driver size on screen they don't show, so the figure gets a plain matte cloth finish instead
for (const m of root.listMaterials()) {
  m.setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(0.85).setEmissiveFactor([0, 0, 0]);
}

// one mesh in its world placement (figure 1.9 m tall, feet at y -0.95, facing +z)
await doc.transform(flatten(), join(), prune());
for (const n of root.listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const m = n.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    // the extra UV sets are unused by its material: drop them (they only add weight)
    for (const sem of p.listSemantics()) if (/^TEXCOORD_[1-9]$/.test(sem)) p.setAttribute(sem, null);
    p.setAttribute('TANGENT', null);   // rebuilt by the renderer from the bent normals
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), e = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, e);
      pos.setElement(i, [0, 1, 2].map((k) => m[k] * e[0] + m[4 + k] * e[1] + m[8 + k] * e[2] + m[12 + k]));
      if (nor) { nor.getElement(i, e); const r = [0, 1, 2].map((k) => m[k] * e[0] + m[4 + k] * e[1] + m[8 + k] * e[2]); const l = Math.hypot(...r) || 1; nor.setElement(i, r.map((v) => v / l)); }
    }
  }
  n.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// ---------------------------------------------------------------- seat him: bend at the hips and knees
// pivots measured from the figure (x across, y up, z forward): hip line at y 0.0, knee line at y -0.46
const POSE = { hipY: 0.0, hipZ: -0.02, kneeY: -0.46, kneeZ: -0.03, recline: 18, thigh: 92, knee: 62 };
const deg = Math.PI / 180;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const rotX = (y, z, cy, cz, a) => { const dy = y - cy, dz = z - cz, c = Math.cos(a), s = Math.sin(a); return [cy + dy * c - dz * s, cz + dy * s + dz * c]; };
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), e = [0, 0, 0], q = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, e); if (nor) nor.getElement(i, q);
    const y0 = e[1];
    // knee: the shin folds back (positive about x moves a point below the pivot backward)
    const wk = smooth(POSE.kneeY + 0.05, POSE.kneeY - 0.07, y0), ak = POSE.knee * deg * wk;
    [e[1], e[2]] = rotX(e[1], e[2], POSE.kneeY, POSE.kneeZ, ak);
    if (nor) [q[1], q[2]] = rotX(q[1], q[2], 0, 0, ak);
    // hip: the torso leans back, the legs swing forward (negative about x), blended over the hip band
    const wh = smooth(POSE.hipY + 0.07, POSE.hipY - 0.11, y0);
    const ah = -(POSE.recline + (POSE.thigh - POSE.recline) * wh) * deg;
    [e[1], e[2]] = rotX(e[1], e[2], POSE.hipY, POSE.hipZ, ah);
    if (nor) [q[1], q[2]] = rotX(q[1], q[2], 0, 0, ah);
    pos.setElement(i, e); if (nor) { const l = Math.hypot(...q) || 1; nor.setElement(i, q.map((v) => v / l)); }
  }
}

// ---------------------------------------------------------------- web size
await doc.transform(weld(), dedup(), prune());
const tris = () => root.listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((u, p) => u + p.getIndices().getCount() / 3, 0), 0);
const before = tris();
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / before), error: 0.002, lockBorder: false }), weld(), prune());
console.log('tris', before, '->', tris());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
const b = getBounds(root.listScenes()[0]);
await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
root.getAsset().extras = { ...(root.getAsset().extras || {}), rcDriver: { pose: POSE, bounds: { min: b.min, max: b.max } } };
await io.write(outFile, doc);
console.log('pose', JSON.stringify(POSE), 'bounds', JSON.stringify({ min: b.min, max: b.max }));
