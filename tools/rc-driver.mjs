// RC Crawler driver: turn "Casual Confidence" (restore50, CC BY 4.0; a standing figure, hands in pockets, no
// skeleton) into the game's driver (public/rc-crawler/assets/driver.glb). It stays standing, as modelled: the game
// builds a skeleton for it and skins it at load (src/vehicles/driverRig.js), then seats it, steers with it and
// walks it. Here it is only baked to one mesh in its world placement, simplified (keeping its UVs), its texture
// goes to WebP and its geometry is meshopt-compressed.
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

// ---------------------------------------------------------------- web size
await doc.transform(weld(), dedup(), prune());
const tris = () => root.listMeshes().reduce((t, m) => t + m.listPrimitives().reduce((u, p) => u + p.getIndices().getCount() / 3, 0), 0);
const before = tris();
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, target / before), error: 0.002, lockBorder: false }), weld(), prune());
console.log('tris', before, '->', tris());
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }));
const b = getBounds(root.listScenes()[0]);
await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
root.getAsset().extras = { ...(root.getAsset().extras || {}), rcDriver: { bounds: { min: b.min, max: b.max } } };
await io.write(outFile, doc);
console.log('bounds', JSON.stringify({ min: b.min, max: b.max }));
