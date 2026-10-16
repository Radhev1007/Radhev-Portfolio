// RC Crawler vehicle bodies: turn a downloaded car model (.glb) into a body shell for the game's RC chassis
// (public/rc-crawler/assets/vehicles, mounted by public/rc-crawler/src/vehicles/bodies.js).
//
// It removes the model's wheels and running gear (the RC chassis brings its own), merges parts by material,
// simplifies to ~60k triangles, shrinks textures to WebP, compresses the geometry (meshopt), and prints where the
// wheels were: those numbers go into the body's `wheels` entry in bodies.js, which lines the arches up over the
// RC axles.
//
// The tools it needs are not part of the portfolio's dependencies; install them anywhere and point at them:
//   npm i --prefix /tmp/rc-bodies @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 \
//     @gltf-transform/functions@4.5.1 meshoptimizer@0.21.0 sharp@0.35.5
//   RC_BODIES_DEPS=/tmp/rc-bodies node tools/rc-bodies.mjs bronco ~/Downloads/2022_ford_bronco.glb \
//     public/rc-crawler/assets/vehicles/bronco.glb
// ids with their own wheel handling: bronco (2022 Ford Bronco, tonielpro520), cruiser (Older Matte Land Cruiser,
// jtressle), gladiator (2020 Jeep Gladiator, Ddiaz Design; CC BY-NC-SA, not in the game).
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const req = createRequire(resolve(process.env.RC_BODIES_DEPS || '.', 'index.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { flatten, join, weld, simplify, dedup, prune, textureCompress, meshopt, quantize, getBounds } = req('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');

const [id, inFile, outFile, targetArg] = process.argv.slice(2);
const target = +targetArg || 60000;
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inFile);
const root = doc.getRoot();
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const tris = () => { let n = 0; for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) n += (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3; return Math.round(n); };
console.log(id, 'in: tris', tris(), 'meshes', root.listMeshes().length, 'materials', root.listMaterials().length);

// ---------------------------------------------------------------- wheels out, wheel positions recorded
let wheels = null;   // world space: { front: z, rear: z, y, x (half track), r }
const box = (pts) => { const b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; for (const p of pts) for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], p[k]); b.max[k] = Math.max(b.max[k], p[k]); } return b; };
const nodePoints = (node, every = 1) => { const out = []; const m = node.getWorldMatrix(); for (const p of node.getMesh()?.listPrimitives() || []) { const a = p.getAttribute('POSITION'), e = [0, 0, 0]; for (let i = 0; i < a.getCount(); i += every) { a.getElement(i, e); out.push(mul(m, e[0], e[1], e[2])); } } return out; };
const underName = (node, rx) => { for (let q = node; q; q = q.getParentNode?.()) if (rx.test(q.getName())) return true; return false; };

if (id === 'gladiator') {
  // whole wheel assemblies (tyre + rim) and the brake calipers are their own nodes
  const parts = root.listNodes().filter((n) => n.getMesh() && underName(n, /Wheel1A_3D|Calliper|Caliper/i));
  const tyrePts = parts.filter((n) => underName(n, /Wheel1A_3D/i)).flatMap((n) => nodePoints(n, 7));
  const all = box(root.listNodes().filter((n) => n.getMesh()).flatMap((n) => nodePoints(n, 50)));
  const cz = (all.min[2] + all.max[2]) / 2;
  const fr = box(tyrePts.filter((p) => p[2] > cz)), rr = box(tyrePts.filter((p) => p[2] <= cz)), fl = box(tyrePts.filter((p) => p[2] > cz && p[0] > 0));
  wheels = { front: (fr.min[2] + fr.max[2]) / 2, rear: (rr.min[2] + rr.max[2]) / 2, y: (fr.min[1] + fr.max[1]) / 2, x: (fl.min[0] + fl.max[0]) / 2, r: (fr.max[1] - fr.min[1]) / 2 };
  for (const n of parts) n.dispose();
} else if (id === 'bronco') {
  // tyres, rims and brake discs are separate materials; the spare on the tailgate goes too
  const rx = /^Carro_(Pneu|Freio|Freio_Disco)$/;
  const disc = [];
  for (const n of root.listNodes()) for (const p of n.getMesh()?.listPrimitives() || []) if (/Freio_Disco/.test(p.getMaterial()?.getName() || '')) { const m = n.getWorldMatrix(), a = p.getAttribute('POSITION'), e = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); disc.push(mul(m, e[0], e[1], e[2])); } }
  const road = disc.filter((p) => Math.abs(p[0]) > 0.5);
  const f = box(road.filter((p) => p[2] > 0)), r = box(road.filter((p) => p[2] < 0));
  wheels = { front: (f.min[2] + f.max[2]) / 2, rear: (r.min[2] + r.max[2]) / 2, y: (f.min[1] + f.max[1]) / 2, x: 0.84, r: 0.425 };
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) if (rx.test(p.getMaterial()?.getName() || '')) p.dispose();
} else if (id === 'cruiser') {
  // a photogrammetry scan: the tyres are part of the body mesh, so cut out every triangle inside a tyre cylinder
  wheels = { front: 1.63, rear: -1.23, y: 0.44, x: 0.81, r: 0.44 };
}

// ---------------------------------------------------------------- one geometric cut for every model
// (sizes relative to the model's own wheel radius r, since the models come in different units)
//  - inside each wheel cylinder: rims, hubs, brakes (and the scan's tyres)
//  - the running gear between the wheels below axle height: axles, driveshafts, arms (the RC chassis has its own)
//  - the scan only: anything below the tyres' bottoms (ground picked up by the scan)
{
  const { front, rear, y: wy, x: wx, r } = wheels, scan = id === 'cruiser';
  const RC = r * (scan ? 1.14 : 1.12), XW = r * 0.8;
  const drop = (p) => {
    const ax = Math.abs(p[0]);
    if (Math.abs(ax - wx) < XW) for (const z of [front, rear]) if ((p[2] - z) ** 2 + (p[1] - wy) ** 2 < RC * RC) return true;
    if (ax < wx - 0.45 * r && p[1] < wy + 0.15 * r && p[2] > rear - 1.0 * r && p[2] < front + 1.0 * r) return true;
    if (scan && p[1] < wy - 0.82 * r) return true;
    return false;
  };
  let cut = 0, kept = 0;
  for (const n of root.listNodes()) { const mesh = n.getMesh(); if (!mesh) continue; const m = n.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION'), idx = p.getIndices(), e = [0, 0, 0], at = (i) => { pos.getElement(i, e); return mul(m, e[0], e[1], e[2]); };
      const count = idx ? idx.getCount() : pos.getCount(), get = (k) => (idx ? idx.getScalar(k) : k), keep = [];
      for (let k = 0; k + 2 < count; k += 3) {
        const a = at(get(k)), b = at(get(k + 1)), c = at(get(k + 2));
        if (drop([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3])) { cut++; continue; }
        keep.push(get(k), get(k + 1), get(k + 2)); kept++;
      }
      if (!keep.length) { p.dispose(); continue; }
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(pos.getCount() > 65535 ? new Uint32Array(keep) : new Uint16Array(keep)).setBuffer(root.listBuffers()[0]));
    }
  }
  console.log('  cut', cut, 'triangles (wheels, running gear' + (scan ? ', ground' : '') + '), kept', kept);
}

// ---------------------------------------------------------------- materials the game can draw cheaply
for (const mat of root.listMaterials()) {
  // transmission needs an extra render pass: plain tinted transparency instead
  if (mat.getExtension('KHR_materials_transmission')) { mat.setExtension('KHR_materials_transmission', null); mat.setAlphaMode('BLEND'); const c = mat.getBaseColorFactor(); mat.setBaseColorFactor([c[0] * 0.25, c[1] * 0.27, c[2] * 0.3, 0.55]); mat.setRoughnessFactor(0.05); }
  // the scan is unlit (lighting baked into its photos): make it a normal lit, matte surface so night and shade affect it
  if (mat.getExtension('KHR_materials_unlit')) { mat.setExtension('KHR_materials_unlit', null); mat.setMetallicFactor(0); mat.setRoughnessFactor(0.92); }
}
for (const ext of root.listExtensionsUsed()) if (['KHR_materials_transmission', 'KHR_materials_unlit'].includes(ext.extensionName)) ext.dispose();

// ---------------------------------------------------------------- geometry
await doc.transform(prune(), flatten(), join({ keepNamed: false }), weld(), dedup(), prune());
const before = tris();
const ratio = Math.min(1, target / Math.max(1, before));
if (ratio < 0.98) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 }), weld(), prune());
console.log('  tris', before, '->', tris(), 'meshes', root.listMeshes().length, 'materials', root.listMaterials().length);

// ---------------------------------------------------------------- textures, compression
const texSize = id === 'cruiser' ? [2048, 2048] : [1024, 1024];
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: texSize, quality: 82 }));
const bounds = getBounds(root.listScenes()[0]);
await doc.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
doc.getRoot().getAsset().extras = { ...(doc.getRoot().getAsset().extras || {}), rcBody: { wheels, bounds: { min: bounds.min, max: bounds.max } } };
await io.write(outFile, doc);
console.log('  wheels', JSON.stringify(wheels), 'bounds', JSON.stringify({ min: bounds.min, max: bounds.max }));
