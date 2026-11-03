// The driver's skeleton. The driver model (assets/driver.glb, "Casual Confidence" by restore50) is a static
// standing figure with no rig: this builds one for it. Sixteen bones sit at the figure's joints (measured from the
// model: x across, his left +x; y up; z forward; feet at y -0.95, 1.9 units tall), each vertex is weighted to the
// bones nearest it (blended across each joint), and poses are bone rotations: seated at the wheel, walking.
//
// His hands rest in his trouser pockets and his arms hang against his sides. The triangles joining parts that only
// touch (hand and pocket, arm and side, knee and knee) are cut, so a limb can move away without dragging the
// surface it touched with it.
import * as THREE from 'three';

// figure units -> game units, and the on-foot numbers (game units)
export const FIGURE = { scale: 0.38, footY: -0.95, exitDist: 0.75, radius: 0.12 };

// [name, parent, joint position, radius of the limb around it]; a bone's segment runs to its first child (or tip)
export const BONES = [
  { name: 'hips', parent: null, at: [0, 0.0, 0], tip: [0, 0.22, -0.03], r: 0.17, group: 0 },
  { name: 'spine', parent: 'hips', at: [0, 0.22, -0.03], r: 0.17, group: 0 },
  { name: 'chest', parent: 'spine', at: [0, 0.42, -0.04], r: 0.18, group: 0 },
  { name: 'neck', parent: 'chest', at: [0, 0.62, -0.03], r: 0.06, group: 0 },
  { name: 'head', parent: 'neck', at: [0, 0.7, 0.0], tip: [0, 0.95, 0.02], r: 0.11, group: 0 },
  { name: 'upperArmL', parent: 'chest', at: [0.2, 0.52, -0.06], r: 0.055, group: 1 },
  { name: 'foreArmL', parent: 'upperArmL', at: [0.23, 0.2, -0.06], r: 0.045, group: 1 },
  { name: 'handL', parent: 'foreArmL', at: [0.22, 0.0, 0.01], tip: [0.2, -0.08, 0.04], r: 0.045, group: 1 },
  { name: 'upperArmR', parent: 'chest', at: [-0.25, 0.52, 0.0], r: 0.06, group: 2 },
  { name: 'foreArmR', parent: 'upperArmR', at: [-0.245, 0.2, 0.03], r: 0.05, group: 2 },
  { name: 'handR', parent: 'foreArmR', at: [-0.2, 0.0, 0.06], tip: [-0.17, -0.12, 0.08], r: 0.05, group: 2 },
  { name: 'thighL', parent: 'hips', at: [0.08, -0.02, 0], r: 0.085, group: 3 },
  { name: 'shinL', parent: 'thighL', at: [0.19, -0.44, -0.02], r: 0.06, group: 3 },
  { name: 'ankleL', parent: 'shinL', at: [0.16, -0.82, -0.09], tip: [0.17, -0.93, 0.1], r: 0.06, group: 3 },
  { name: 'thighR', parent: 'hips', at: [-0.08, -0.02, 0], r: 0.085, group: 4 },
  { name: 'shinR', parent: 'thighR', at: [-0.07, -0.44, -0.02], r: 0.06, group: 4 },
  { name: 'ankleR', parent: 'shinR', at: [-0.04, -0.82, -0.09], tip: [-0.03, -0.93, 0.1], r: 0.06, group: 4 },
];
const IDX = Object.fromEntries(BONES.map((b, i) => [b.name, i]));
// each bone's segment end: its tip, else its first child's joint
for (const b of BONES) b.end = b.tip || BONES.find((c) => c.parent === b.name).at;
// neighbours a vertex may blend between (a bone, its parent, its children)
const NEAR = BONES.map((b) => [IDX[b.name], ...(b.parent ? [IDX[b.parent]] : []), ...BONES.filter((c) => c.parent === b.name).map((c) => IDX[c.name])]);

const TORSO_HALF = 0.21;   // the body's half width from hand height to the shoulders (measured from the figure)

function segDist(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.min(1, Math.max(0, (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2])));
  return Math.hypot(v[0] - d[0] * t, v[1] - d[1] * t, v[2] - d[2] * t);
}

/**
 * Skin weights for the figure's vertices (positions in figure units): four bones per vertex, blended across the
 * joints of its nearest bone. `group` is the vertex's part (0 body, 1 left arm, 2 right arm, 3 left leg, 4 right
 * leg), for cutting where parts only touch.
 */
export function skinWeights(pos) {
  const n = pos.length / 3, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4), group = new Uint8Array(n);
  const score = new Float32Array(BONES.length), p = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    p[0] = pos[i * 3]; p[1] = pos[i * 3 + 1]; p[2] = pos[i * 3 + 2];
    let best = 0;
    for (let b = 0; b < BONES.length; b++) {
      const B = BONES[b];
      // a hand takes only what is above its fingertips: below them is the pocket, which stays on the thigh; between
      // the hands and the shoulders the body is no wider than TORSO_HALF and the arms hang outside it
      score[b] = (B.name.startsWith('hand') && p[1] < B.end[1]) || (B.group === 0 && B.name !== 'head' && B.name !== 'neck' && p[1] > -0.12 && p[1] < 0.45 && Math.abs(p[0]) > TORSO_HALF)
        ? 1e9 : segDist(p, B.at, B.end) / B.r;
      if (score[b] < score[best]) best = b;
    }
    group[i] = BONES[best].group;
    const cand = NEAR[best].filter((b) => score[b] < score[best] * 1.6 + 0.15).map((b) => [b, 1 / (score[b] + 0.05) ** 4]).sort((a, c) => c[1] - a[1]).slice(0, 4);
    const sum = cand.reduce((t, c) => t + c[1], 0);
    cand.forEach(([b, w], k) => { index[i * 4 + k] = b; weight[i * 4 + k] = w / sum; });
  }
  return { index, weight, group };
}

// an arm is joined to the body at the shoulder only: below this (rest pose) an arm touching his side is just touching
const SHOULDER_CUT = 0.42;
/**
 * Drop the triangles joining parts that only touch in the standing scan, so posing does not stretch them into a
 * sheet: a hand in its pocket (arm and leg), an arm against his side below the shoulder (arm and body), one knee
 * against the other (left and right leg). The shoulders and hips, where limbs really join the body, stay.
 * `pos` (rest positions) is needed for the shoulder test; without it only arm-leg and leg-leg joins are cut.
 */
export function cullSeams(idx, group, pos = null) {
  const out = [];
  for (let k = 0; k + 2 < idx.length; k += 3) {
    const g = [group[idx[k]], group[idx[k + 1]], group[idx[k + 2]]];
    const arm = g.some((x) => x === 1 || x === 2), leg = g.some((x) => x === 3 || x === 4), body = g.includes(0);
    if (arm && leg) continue;                                          // hand in pocket
    if (g.includes(3) && g.includes(4)) continue;                      // knees together
    if (g.includes(1) && g.includes(2)) continue;
    if (arm && body && pos && Math.min(pos[idx[k] * 3 + 1], pos[idx[k + 1] * 3 + 1], pos[idx[k + 2] * 3 + 1]) < SHOULDER_CUT) continue;   // arm against his side
    out.push(idx[k], idx[k + 1], idx[k + 2]);
  }
  return idx instanceof Uint16Array ? new Uint16Array(out) : new Uint32Array(out);
}

/** The bones, at the standing (bind) pose: { root, bones: {name: Bone}, list: [Bone in BONES order] }. */
export function buildSkeleton() {
  const bones = {}, list = [];
  for (const B of BONES) {
    const bone = new THREE.Bone(); bone.name = B.name;
    const par = B.parent ? BONES[IDX[B.parent]].at : [0, 0, 0];
    bone.position.set(B.at[0] - par[0], B.at[1] - par[1], B.at[2] - par[2]);
    if (B.parent) bones[B.parent].add(bone);
    bones[B.name] = bone; list.push(bone);
  }
  const root = bones.hips;
  root.userData.restY = root.position.y;
  return { root, bones, list };
}

const _e = new THREE.Euler();
const rot = (bone, x = 0, y = 0, z = 0) => bone.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ'));
const D = Math.PI / 180;

/**
 * Seated at the wheel. steer -1..1 (left positive), lean: sideways body roll (radians, positive = toward his
 * left), bounce: vertical jolt (-1..1, positive = pushed down into the seat), look: head yaw (radians).
 */
export function poseSeated(rig, { steer = 0, lean = 0, bounce = 0, look = 0 } = {}) {
  const b = rig.bones;
  rig.root.position.y = rig.root.userData.restY;
  rot(b.hips, -18 * D, 0, lean * 0.6);                 // leaning back into the seat; rolls with the corners
  rot(b.spine, 4 * D + bounce * 0.08, 0, lean * 0.3);
  rot(b.chest, 4 * D + bounce * 0.06, steer * 0.08, lean * 0.2);
  rot(b.neck, 6 * D - bounce * 0.1, look * 0.4, -lean * 0.5);
  rot(b.head, 4 * D - bounce * 0.12, look * 0.6, -lean * 0.6);   // the head stays more upright than the body
  // hands out of the pockets and onto the wheel; turning it raises one hand and lowers the other
  const s = Math.max(-1, Math.min(1, steer));
  rot(b.upperArmL, -55 * D - s * 0.3, 0, 0.12);
  rot(b.foreArmL, -40 * D + s * 0.1, 0, -0.1);
  rot(b.handL, 10 * D, 0, 0);
  rot(b.upperArmR, -55 * D + s * 0.3, 0, -0.12);
  rot(b.foreArmR, -40 * D - s * 0.1, 0, 0.1);
  rot(b.handR, 10 * D, 0, 0);
  // legs forward to the pedals
  rot(b.thighL, -74 * D, 0, 0.06); rot(b.shinL, 62 * D, 0, 0); rot(b.ankleL, -20 * D, 0, 0);
  rot(b.thighR, -74 * D, 0, -0.06); rot(b.shinR, 62 * D, 0, 0); rot(b.ankleR, -20 * D, 0, 0);
}

/** Standing and walking: phase in radians (one stride per 2π), amount 0 (standing) .. 1 (walking) .. 1.6 (running). */
export function poseWalk(rig, phase, amount) {
  const b = rig.bones, a = Math.min(1.6, Math.max(0, amount)), s = Math.sin(phase), c = Math.cos(phase);
  for (const bone of rig.list) bone.quaternion.identity();
  rig.root.position.y = rig.root.userData.restY + Math.abs(c) * 0.025 * a - 0.02 * a;
  rot(b.hips, 0.04 * a, s * 0.08 * a, 0);
  rot(b.spine, 0.03 * a * a, -s * 0.05 * a, 0);
  rot(b.chest, 0, -s * 0.06 * a, 0);
  rot(b.head, -0.03 * a, s * 0.03 * a, 0);
  // legs swing opposite; each knee bends as its leg comes through
  rot(b.thighL, -s * 0.45 * a, 0, 0); rot(b.shinL, Math.max(0, c) * 0.9 * a + 0.05 * a, 0, 0);
  rot(b.thighR, s * 0.45 * a, 0, 0); rot(b.shinR, Math.max(0, -c) * 0.9 * a + 0.05 * a, 0, 0);
  rot(b.ankleL, Math.max(0, -s) * 0.25 * a, 0, 0); rot(b.ankleR, Math.max(0, s) * 0.25 * a, 0, 0);
  // hands stay in his pockets: the arms only swing a little with the stride (more when running)
  const arm = a > 1.05 ? (a - 1) * 0.9 : 0.06 * a;
  rot(b.upperArmL, s * arm, 0, 0); rot(b.upperArmR, -s * arm, 0, 0);
  if (a > 1.05) { rot(b.foreArmL, -(a - 1) * 1.4, 0, 0); rot(b.foreArmR, -(a - 1) * 1.4, 0, 0); }
}
