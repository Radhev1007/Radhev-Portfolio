// Per-vehicle running geometry. The SCX30 and the Bronco ride on the RC chassis as built (null: the defaults in
// physics/vehicle.js and crawlerModel.js). The Willys is driven exactly as modelled: the truck takes the buggy's
// own track, tyre size, ride height and body shape, measured from the model (tools/rc-bodies.mjs prints them), at
// the scale that puts its axles on the RC wheelbase.
//
// Model units (as the tool prints them): wheels = hub positions and tyre radius, width = tyre width,
// body = the body's box (without wheels and axles), bellyY = its lowest point between the axles.
export const WILLYS_MODEL = {
  wheels: { front: 1.3558, rear: -1.3554, y: -0.4751, x: 1.0225, r: 0.5643 },
  tyreWidth: 0.4374,
  body: { min: [-0.8619, -0.5037, -1.5509], max: [0.863, 1.0393, 1.7751], bellyY: -0.5023 },
  axleLowY: -0.1564,   // the axle housings' lowest point, below the hub line
};

const WB = 1.12, HUB_Y = -0.10;   // RC wheelbase and hub rest height (CRAWLER_DIMS)

function fromModel(m) {
  const w = m.wheels, s = WB / (w.front - w.rear);
  const oy = HUB_Y - w.y * s, oz = -((w.front + w.rear) / 2) * s;   // where the model's origin sits in the truck
  const Y = (y) => oy + y * s, Z = (z) => oz + z * s;
  const bx = Math.max(-m.body.min[0], m.body.max[0]) * s;
  const zf = Z(m.body.max[2]), zr = Z(m.body.min[2]), belly = Y(m.body.min[1]), top = Y(m.body.max[1]);
  const diffY = HUB_Y + m.axleLowY * s;
  return {
    scale: s, originY: oy, originZ: oz,
    halfTrack: w.x * s, wheelRadius: w.r * s, wheelHalfWidth: (m.tyreWidth * s) / 2,
    bellyY: Y(m.body.bellyY), topY: top, bodyX: bx, bodyZF: zf, bodyZR: zr,
    // collision boxes against posts and terrain spires: [half width, y0, y1, z0, z1, part] (shape measured in slices)
    boxes: [
      [0.26, belly, 0.28, 0.24, zf, 'body'],            // nose and hood
      [bx, belly, 0.30, zr, 0.24, 'body'],              // tub
      [0.33, 0.30, top, -0.45, 0.05, 'roof'],           // roll cage
      [0.30, belly - 0.005, 0.0, -0.40, 0.32, 'skid'],  // belly between the axles
    ],
    // ground probes, in the order of PROBE_PART in physics/vehicle.js
    probes: [
      [0, belly, 0.05], [0.16, belly, 0.3], [-0.16, belly, 0.3], [0.16, belly, -0.3], [-0.16, belly, -0.3], // belly
      [0, diffY, WB / 2], [0, diffY, -WB / 2],                                     // axle housings
      [0.15, 0.06, zf], [-0.15, 0.06, zf], [0, 0.12, zf],                          // front bumper
      [0.2, belly + 0.04, zr], [-0.2, belly + 0.04, zr], [0, 0.3, zr],             // rear
      [0.27, 0.1, 0.62], [-0.27, 0.1, 0.62], [0.3, 0.1, -0.6], [-0.3, 0.1, -0.6],  // corners
      [bx, -0.05, 0], [-bx, -0.05, 0],                                             // sides
      [0.31, top - 0.005, 0], [-0.31, top - 0.005, 0], [0.31, top - 0.005, -0.38], [-0.31, top - 0.005, -0.38], // cage top
      [0.25, 0.27, 0.5], [-0.25, 0.27, 0.5], [0, top - 0.005, -0.2],               // hood corners, cage middle
    ],
  };
}

const GEOMETRY = { willys: fromModel(WILLYS_MODEL) };

/** The running geometry for a vehicle id, or null for the RC chassis as built. */
export const vehicleGeometry = (id) => GEOMETRY[id] || null;
