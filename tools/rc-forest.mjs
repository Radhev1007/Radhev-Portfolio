// RC Crawler forest kit: the trees, plants and a log the terrains are dressed with
// (public/rc-crawler/assets/forest/kit.glb, used by public/rc-crawler/src/terrain/forestKit.js).
//
// The road forest is built from a handful of parts repeated hundreds of times. This keeps one of each, as its own
// node standing on the origin and 1 unit tall (the game scales them per instance):
//   pine     tall pine: bark trunk + crown cards       slim     slender pine
//   fir      young fir                                  bush     leafy bush
//   tuft     grass tuft
// and from the log pile, one big log lying along +X, 1 unit long:
//   log
// Card foliage becomes alpha-tested (not blended) so thousands of instances need no sorting; the log's
// specular-glossiness material becomes metal-rough, which three.js reads.
//
// Models: "a forest (3) with a road at night for game" by dasy444 and "Logs" by Kathrin&Christian, both CC BY 4.0.
// The tools it needs are not part of the portfolio's dependencies (see tools/rc-bodies.mjs for the install line):
//   RC_BODIES_DEPS=/tmp/rc-bodies node tools/rc-forest.mjs ~/Downloads/a_forest_3_with_a_road_at_night_for_game.glb \
//     ~/Downloads/logs.glb public/rc-crawler/assets/forest/kit.glb
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const req = createRequire(resolve(process.env.RC_BODIES_DEPS || '.', 'index.js'));
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const { prune, dedup, weld, textureCompress, meshopt, quantize, metalRough, transformMesh, mergeDocuments } = req('@gltf-transform/functions');
const { MeshoptEncoder } = req('meshoptimizer');
const sharp = req('sharp');

const [forestFile, logsFile, outFile] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];

// world-space vertices of a node
function points(node) {
  const out = [], w = node.getWorldMatrix(), e = [0, 0, 0];
  for (const p of node.getMesh()?.listPrimitives() || []) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, e); out.push(mul(w, ...e)); } }
  return out;
}
const bounds = (pts) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of pts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } return { mn, mx }; };
const uvBox = (prim) => { const uv = prim.getAttribute('TEXCOORD_0'), t = [0, 0], mn = [9, 9], mx = [-9, -9]; if (uv) for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, t); for (let k = 0; k < 2; k++) { mn[k] = Math.min(mn[k], t[k]); mx[k] = Math.max(mx[k], t[k]); } } return [...mn, ...mx].map((v) => v.toFixed(2)).join(','); };

// bake the node's world transform into its mesh and move it to the scene root, then stand it on the origin at
// unit height (or unit length along X for the log); `extra` nodes (a trunk's crown) share the same placement
function standAlone(doc, node, name, extra = [], alongX = false) {
  const scene = doc.getRoot().listScenes()[0];
  const parts = [node, ...extra];
  for (const n of parts) { const w = n.getWorldMatrix(); transformMesh(n.getMesh(), w); n.getParentNode()?.removeChild(n); scene.addChild(n); n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]); }
  let pts = parts.flatMap(points);
  let rot = null;
  if (alongX) {   // turn the log's long axis (in the ground plane) onto X
    const b0 = bounds(pts), c = [(b0.mn[0] + b0.mx[0]) / 2, (b0.mn[2] + b0.mx[2]) / 2];
    let sxx = 0, szz = 0, sxz = 0; for (const p of pts) { const dx = p[0] - c[0], dz = p[2] - c[1]; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
    const a = 0.5 * Math.atan2(2 * sxz, sxx - szz), ca = Math.cos(a), sa = Math.sin(a);
    rot = [ca, 0, -sa, 0, 0, 1, 0, 0, sa, 0, ca, 0, 0, 0, 0, 1];   // rotate by -a about Y (column-major)
    for (const n of parts) transformMesh(n.getMesh(), rot);
    pts = parts.flatMap(points);
  }
  const { mn, mx } = bounds(pts), size = mx.map((v, k) => v - mn[k]);
  const k = 1 / (alongX ? size[0] : size[1]);
  const T = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -(mn[0] + mx[0]) / 2 * k, -mn[1] * k, -(mn[2] + mx[2]) / 2 * k, 1];
  for (const n of parts) transformMesh(n.getMesh(), T);
  // one parent node per part, named plainly (three.js drops dots from names)
  const holder = doc.createNode(name);
  scene.addChild(holder);
  parts.forEach((n, i) => { scene.removeChild(n); holder.addChild(n); n.setName(`${name}_${i}`); });
  console.log(' ', name.padEnd(8), 'from', size.map((v) => v.toFixed(2)).join(' x '), 'tris', parts.reduce((t, n) => t + n.getMesh().listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0), 0));
  return [holder, ...parts];
}

// ---------------------------------------------------------------- forest: one of each repeated part
const forest = await io.read(forestFile);
{
  const root = forest.getRoot(), keep = [];
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  const info = meshNodes.map((n) => { const p = n.getMesh().listPrimitives()[0]; const b = bounds(points(n)); return { n, mat: p.getMaterial()?.getName(), tris: p.getIndices().getCount() / 3, uv: uvBox(p), h: b.mx[1] - b.mn[1], b }; });
  // the most typical member (median height) of a part type
  const pick = (test) => { const l = info.filter(test).sort((a, b) => a.h - b.h); return l[Math.floor(l.length / 2)]; };
  const card = (tris, u0) => (i) => i.mat === 'Material' && i.tris === tris && i.uv.startsWith(u0);
  const tuft = pick(card(24, '0.03')), cover = pick(card(144, '0.33')), sapling = pick(card(152, '0.00')), shrub = pick(card(248, '0.27'));
  // pine: a bark trunk (Material.004) with its crown (the card cylinder standing on the same spot)
  const trunk = pick((i) => i.mat === 'Material.004');
  const near = (a, b) => Math.hypot((a.b.mn[0] + a.b.mx[0]) / 2 - (b.b.mn[0] + b.b.mx[0]) / 2, (a.b.mn[2] + a.b.mx[2]) / 2 - (b.b.mn[2] + b.b.mx[2]) / 2);
  const crown = info.filter((i) => i.mat === 'Material' && i.tris === 264).sort((a, b) => near(a, trunk) - near(b, trunk))[0];
  keep.push(...standAlone(forest, trunk.n, 'pine', [crown.n]));
  keep.push(...standAlone(forest, sapling.n, 'slim'));
  keep.push(...standAlone(forest, shrub.n, 'fir'));
  keep.push(...standAlone(forest, cover.n, 'bush'));
  keep.push(...standAlone(forest, tuft.n, 'tuft'));
  for (const n of root.listNodes()) if (!keep.includes(n)) n.dispose();
  // cards: cut out, not blended
  for (const m of root.listMaterials()) if (m.getAlphaMode() === 'BLEND') m.setAlphaMode('MASK').setAlphaCutoff(0.5);
  await forest.transform(prune(), dedup());
}

// ---------------------------------------------------------------- log
const logs = await io.read(logsFile);
await logs.transform(metalRough());
{
  const root = logs.getRoot();
  const big = root.listNodes().find((n) => n.getMesh() && /log_big_right/.test(n.getName()))
    || root.listNodes().find((n) => n.getMesh() && /log_big/.test(n.getName()));
  const kept = standAlone(logs, big, 'log', [], true);
  for (const n of root.listNodes()) if (!kept.includes(n)) n.dispose();
  for (const l of root.listExtensionsUsed()) if (/lights_punctual/.test(l.extensionName)) l.dispose();
  await logs.transform(prune(), dedup());
}

// ---------------------------------------------------------------- one file
mergeDocuments(forest, logs);
{
  const root = forest.getRoot(), [main, ...rest] = root.listScenes();
  for (const s of rest) { for (const n of s.listChildren()) main.addChild(n); s.dispose(); }
  root.setDefaultScene(main);
  const buffers = root.listBuffers(); for (const b of buffers.slice(1)) { for (const a of root.listAccessors()) if (a.getBuffer() === b) a.setBuffer(buffers[0]); b.dispose(); }
}
await forest.transform(weld(), dedup(), prune());
await forest.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 85 }));
await forest.transform(quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
forest.getRoot().getAsset().extras = { credits: [
  'a forest (3) with a road at night for game by dasy444, CC BY 4.0: https://sketchfab.com/3d-models/a-forest-3-with-a-road-at-night-for-game-61f8c7817fe6457fb26e4814cfc48a3f',
  'Logs by Kathrin&Christian, CC BY 4.0: https://sketchfab.com/3d-models/logs-54d0c962a0e24dadb2c01477fd4741f9',
] };
await io.write(outFile, forest);
console.log('wrote', outFile, forest.getRoot().listNodes().map((n) => n.getName()).join(' '));
