// Vehicle bodies: the SCX30 Wrangler (built in crawlerModel.js) and hard-body shells from real 3D models, mounted
// on the same RC chassis the way real RC trucks swap bodies. The chassis, tyres, axles, suspension, physics and
// multiplayer sync stay exactly the same; only the shell above the frame changes.
//
// The shells were prepared offline from Sketchfab models (wheels and running gear removed, simplified, textures
// shrunk to WebP, geometry meshopt-compressed); each records where its own wheels were, so it can be scaled and
// placed with its wheel arches over the RC axles.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CRAWLER_DIMS } from './crawlerModel.js';
import { vehicleGeometry, WILLYS_MODEL } from './geometry.js';

// The driver in the open Willys: restore50's "Casual Confidence" (CC BY 4.0, credited in Help), seated by bending the
// figure at the hips and knees (tools/rc-driver.mjs), simplified for the web.
export const DRIVER_CREDIT = { title: 'Casual Confidence', author: 'restore50', changes: 'seated, simplified', url: 'https://sketchfab.com/3d-models/casual-confidence-cddbbc7660454ec9997cacb9ab6cf58d', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };
const DRIVER_FILE = 'assets/driver.glb';

export const VEHICLES = [
  { id: 'scx30', name: 'SCX30 Jeep Wrangler JLU', short: 'WRANGLER', color: 0xf1f1ee },   // gloss white
  {
    id: 'bronco', name: '2022 Ford Bronco', short: 'BRONCO', color: 0xa8141c, file: 'assets/vehicles/bronco.glb', paint: /Pintura/i, lamps: /Refletor_Farol/i, exact: true,   // as modelled
    wheels: { front: 1.611, rear: -1.264, y: 0.425, x: 0.84, r: 0.425 },
    credit: { title: '2022 Ford Bronco', author: 'tonielpro520', changes: 'its wheels moved onto the RC hubs, tyres and alloys in black', url: 'https://sketchfab.com/3d-models/2022-ford-bronco-9eda0b20a8454f7b936ac2a393d82e8f', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  },
  {
    // an open buggy on solid axles, exactly as modelled (every triangle, its own four wheels): the truck takes its
    // track, tyre size and ride height (geometry.js); its wheels turn and steer on the hubs and its axle housings,
    // tie rods and knuckles ride on the axles
    id: 'willys', name: 'Willys Mountain Buggy', short: 'WILLYS', file: 'assets/vehicles/willys.glb', paint: null, own: true,
    // the driver in the left (driver's) seat, in the model's units: his hip line over the seat cushion
    driver: { at: [0.38, 0.15, -0.4], scale: 0.92 },
    wheels: WILLYS_MODEL.wheels,
    credit: { title: 'Willys mountain buggy 1', author: 'Rustam T', changes: 'textures resized for the web; its wheels and axles move with the suspension', url: 'https://sketchfab.com/3d-models/willys-mountain-buggy-1-f536a233a3d84735ab4b967f90e212db', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  },
];
export const VEHICLE_IDS = VEHICLES.map((v) => v.id);
export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
// a body's own colour when driving alone (in multiplayer each player's livery colour is used instead); a body
// without one (the Willys, textured as modelled) keeps the default
export const vehicleColor = (id) => vehicleById(id).color ?? 0xf1f1ee;

// RC chassis reference: axles at +-wheelBase/2, hubs at hubRestY, tyres of wheelRadius
const WB = CRAWLER_DIMS.wheelBase, HUB_Y = CRAWLER_DIMS.hubRestY, TYRE_R = CRAWLER_DIMS.wheelRadius, HALF_TRACK = CRAWLER_DIMS.track / 2;
// the RC tyres are much bigger than the scaled real ones: the shell sits higher so its arches clear them over
// the suspension travel, as a hard body on a lifted crawler does
const LIFT = 0.075;

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const templates = new Map();   // id -> Promise<Object3D> (loaded once, shared by every truck using it)

function template(v) {
  if (!templates.has(v.id)) {
    const url = new URL(`../../${v.file}`, import.meta.url).href;
    const driver = v.driver ? loader.loadAsync(new URL(`../../${DRIVER_FILE}`, import.meta.url).href).then((g) => g.scene).catch((e) => { console.warn('[bodies] driver failed to load', e); return null; }) : null;
    templates.set(v.id, Promise.all([loader.loadAsync(url), driver]).then(([gltf, d]) => { if (d) seatDriver(gltf.scene, d, v.driver); return fit(gltf.scene, v); }).catch((e) => { templates.delete(v.id); throw e; }));
  }
  return templates.get(v.id);
}

// scale by wheelbase, centre between the axles, wheel centres just above the RC hubs, a touch wider if its track is
// narrower than the RC track (so the tyres sit under the flares rather than outside them); an `exact` body keeps
// its own proportions
function fit(scene, v) {
  if (v.own) return fitOwn(scene, v);
  const w = v.wheels, s = WB / (w.front - w.rear);
  const sx = v.fitTrack ? HALF_TRACK / (w.x * s) : v.exact ? 1 : Math.min(1.12, Math.max(0.96, HALF_TRACK / (w.x * s)));
  const holder = new THREE.Group();
  holder.name = `Body:${v.id}`;
  scene.scale.set(s * sx, s, s);
  scene.position.set(0, HUB_Y + LIFT + (TYRE_R - w.r * s) * 0.35 - w.y * s, -((w.front + w.rear) / 2) * s);
  // a body that brings its own wheel (saved on its own, centred on its hub): sized to the RC tyre, so it
  // meets the ground where the physics put the tyre
  const wheel = scene.getObjectByName('RCWheel');
  if (wheel) {
    wheel.removeFromParent();   // (its own transform undoes the geometry compression: keep it, scale around it)
    const sized = new THREE.Group();
    sized.name = `Wheel:${v.id}`;
    sized.add(wheel);
    sized.scale.setScalar(TYRE_R / w.r);
    wheel.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    holder.userData.wheel = sized;
  }
  // a body that brings its own running gear (axle pieces centred on their axle line): sized like the body, carried
  // on the RC axles
  const gear = ['AxleFront', 'AxleRear'].map((name) => {
    const piece = scene.getObjectByName(name);
    if (!piece) return null;
    piece.removeFromParent();
    const sized = new THREE.Group();
    sized.name = `Gear:${v.id}:${name}`;
    sized.add(piece);
    sized.scale.set(s * sx, s, s);
    piece.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return sized;
  });
  if (gear[0] || gear[1]) holder.userData.gear = { front: gear[0], rear: gear[1] };
  holder.add(scene);
  holder.updateMatrixWorld(true);
  holder.userData.noseZ = new THREE.Box3().setFromObject(scene).max.z;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { m.envMapIntensity = 1; darkInside(m); if (m.transparent) o.castShadow = false; }
  });
  return holder;
}

// the driver goes in as part of the body (it moves, rolls and is recovered with it)
function seatDriver(scene, d, at) {
  d.name = 'Driver';
  d.position.fromArray(at.at);
  d.scale.setScalar(at.scale);
  d.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(d);
}

// a body driven as modelled: one uniform scale (its axles on the RC wheelbase), its hubs on the truck's hub line,
// its own four wheels each at its own size; the physics take the same geometry (geometry.js)
function fitOwn(scene, v) {
  const g = vehicleGeometry(v.id), s = g.scale;
  const holder = new THREE.Group();
  holder.name = `Body:${v.id}`;
  scene.scale.setScalar(s);
  scene.position.set(0, g.originY, g.originZ);
  const sized = (node, name) => {
    node.removeFromParent();
    const grp = new THREE.Group();
    grp.name = name; grp.add(node); grp.scale.setScalar(s);
    node.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return grp;
  };
  const wheels = ['FL', 'FR', 'RL', 'RR'].map((k) => scene.getObjectByName(`RCWheel_${k}`));
  if (wheels.every(Boolean)) holder.userData.wheel = wheels.map((n, i) => sized(n, `Wheel:${v.id}:${i}`));
  const gear = ['AxleFront', 'AxleRear'].map((name) => { const n = scene.getObjectByName(name); return n ? sized(n, `Gear:${v.id}:${name}`) : null; });
  if (gear[0] || gear[1]) holder.userData.gear = { front: gear[0], rear: gear[1] };
  holder.add(scene);
  holder.updateMatrixWorld(true);
  holder.userData.noseZ = new THREE.Box3().setFromObject(scene).max.z;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { m.envMapIntensity = 1; if (m.transparent) o.castShadow = false; }   // as modelled: no dark-inside tweak
  });
  return holder;
}

// The inside of the shell renders dark: from below (on its side, cresting a rock, through the arches) a body shows
// a dark underbody instead of the white inside of its panels. Every shell surface is drawn from both sides for that.
function darkInside(m) {
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor.rgb *= 0.08;');
  };
  m.customProgramCacheKey = () => 'body-dark-inside';
  return m;
}

// mount (or remove) a body on a crawler model; returns once it is in place. `color` repaints a body that has paint.
export async function mountBody(model, id, color) {
  const v = vehicleById(id);
  const token = (model._bodyToken = (model._bodyToken || 0) + 1);
  const unmount = () => {
    if (model._body) { model.group.remove(model._body); model._body = null; }
    for (const list of [model.extraPaint, model.extraLamps]) { for (const m of list) m.dispose(); list.length = 0; }
  };
  if (!v.file) { unmount(); model.setShellVisible(true); model.setLampZ(); model.setWheelVisual(null); model.setRunningGear(null); model.setTrack(); model._bodyId = v.id; return; }
  let tpl;
  try { tpl = await template(v); } catch (e) { console.warn('[bodies] could not load', v.id, e); return; }
  if (token !== model._bodyToken || model.disposed) return;   // another body was asked for meanwhile, or the truck is gone
  unmount();
  const body = tpl.clone(true);
  // paint (each player's livery) and headlamps (each truck's lights) are per truck: clone those materials,
  // share everything else
  body.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      const list = v.paint?.test(m.name || '') ? model.extraPaint : v.lamps?.test(m.name || '') ? model.extraLamps : null;
      if (!list) return m;
      const c = darkInside(m.clone()); list.push(c);   // (a clone doesn't keep the shader tweak)
      if (list === model.extraLamps) c.emissive.setHex(0xfff1dc);
      else c.userData.ownHex = m.color.getHex();   // the model's own paint, kept for the default white livery
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  model.setBodyColor(color ?? model.paintHex);
  model.group.add(body);
  model._body = body; model._bodyId = v.id;
  model.setShellVisible(false);
  model.setLampZ(tpl.userData.noseZ + 0.01);
  model.setWheelVisual(tpl.userData.wheel || null);
  model.setRunningGear(tpl.userData.gear || null);
  model.setTrack(vehicleGeometry(v.id)?.halfTrack);
}
