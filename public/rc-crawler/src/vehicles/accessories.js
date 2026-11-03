// Accessories the garage bolts on (vehicles/parts.js `acc`): an LED light bar, a roof rack, rock sliders and a
// tube bumper, built from tubes and plates and placed on each body's own roof, sills and nose (MOUNTS, in the
// truck's frame: x across, y up, z forward). The light bar's lens is a lamp: it lights with the headlights.
import * as THREE from 'three';

const MOUNTS = {
  scx30: { roofY: 0.565, roofZ: [-0.76, 0.16], halfX: 0.31, frontZ: 0.83, bumperY: 0.02, sillY: -0.02, sillX: 0.41, sillZ: [-0.36, 0.3] },
  bronco: { roofY: 0.59, roofZ: [-0.74, 0.12], halfX: 0.32, frontZ: 0.84, bumperY: 0.03, sillY: -0.01, sillX: 0.42, sillZ: [-0.36, 0.3] },
  willys: { roofY: 0.535, roofZ: [-0.44, 0.04], halfX: 0.32, frontZ: 0.74, bumperY: -0.01, sillY: -0.07, sillX: 0.37, sillZ: [-0.34, 0.3] },
};

let mats = null;
const materials = () => (mats ||= {
  steel: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.45, metalness: 0.7 }),
  housing: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5, metalness: 0.4 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.6, metalness: 0.6 }),
});

/** A tube from a to b (truck frame), radius r. */
function tube(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const box = (w, h, d, at, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(...at); return m; };

const BUILD = {
  lightbar(M, g, lamps) {
    const z = M.roofZ[1] - 0.02, y = M.roofY + 0.06, w = M.halfX * 1.7;
    const lens = new THREE.MeshStandardMaterial({ color: 0x8a8f96, emissive: 0xfff4e0, emissiveIntensity: 0, roughness: 0.15, metalness: 0.2 });
    lens.userData.lamp = true; lamps.push(lens);
    g.add(box(w, 0.045, 0.045, [0, y, z], materials().housing), box(w * 0.94, 0.03, 0.006, [0, y, z + 0.024], lens));
    for (const s of [-1, 1]) g.add(tube([s * w * 0.42, M.roofY, z - 0.02], [s * w * 0.42, y - 0.02, z], 0.007, materials().steel));
  },
  rack(M, g) {
    const y = M.roofY + 0.035, [z0, z1] = M.roofZ, x = M.halfX * 0.92, r = 0.008, s = materials().steel;
    for (const sx of [-1, 1]) g.add(tube([sx * x, y, z0], [sx * x, y, z1], r, s));
    for (let i = 0; i <= 4; i++) { const z = z0 + ((z1 - z0) * i) / 4; g.add(tube([-x, y, z], [x, y, z], r * 0.8, s)); }
    for (const sx of [-1, 1]) for (const z of [z0 + 0.04, z1 - 0.04]) g.add(tube([sx * x, M.roofY, z], [sx * x, y, z], r * 0.8, s));
  },
  sliders(M, g) {
    const [z0, z1] = M.sillZ, s = materials().steel;
    for (const sx of [-1, 1]) {
      const x = sx * M.sillX;
      g.add(tube([x, M.sillY, z0], [x, M.sillY, z1], 0.014, s));
      for (const z of [z0 + 0.06, (z0 + z1) / 2, z1 - 0.06]) g.add(tube([x, M.sillY, z], [x - sx * 0.08, M.sillY + 0.03, z], 0.009, s));
    }
  },
  bumper(M, g) {
    const z = M.frontZ + 0.03, y = M.bumperY, x = M.halfX * 0.95, s = materials().steel;
    g.add(tube([-x, y, z], [x, y, z], 0.014, s), tube([-x * 0.6, y + 0.09, z - 0.01], [x * 0.6, y + 0.09, z - 0.01], 0.011, s));
    for (const sx of [-1, 1]) g.add(tube([sx * x, y, z], [sx * x * 0.6, y + 0.09, z - 0.01], 0.011, s));
    g.add(box(x * 1.1, 0.05, 0.01, [0, y - 0.035, z - 0.005], materials().plate));   // skid plate under it
  },
};

/** The accessories `ids` for vehicle `vehicleId`, as one group in the truck's frame; its lamp materials in userData.lamps. */
export function buildAccessories(ids = [], vehicleId = 'scx30') {
  const M = MOUNTS[vehicleId] || MOUNTS.scx30, g = new THREE.Group(), lamps = [];
  g.name = 'accessories';
  for (const id of ids) BUILD[id]?.(M, g, lamps);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.lamps = lamps;
  return g;
}
