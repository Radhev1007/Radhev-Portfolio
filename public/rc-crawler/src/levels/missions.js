// Missions: challenges laid along each terrain's main trail, beside the activity sections. Each is an ordinary
// challenge (ordered gates, rules, a par time for medals) so the rings, timer, medals and career all apply.
//
//   climb     the trail's steepest stretch, bottom to top, without rolling over
//   race      a long stretch against the clock, through a checkpoint every ~20 m
//   recovery  out to a crawler that has broken down beside the trail and back to the start, without rolling
//
// Placed from the trail's real heights after the trail obstacles and activities, so the climb climbs what is
// there; every start ring is kept clear of every other ring.
import { ringFor } from '../world/challengeRings.js';

const START = 12, END = 6;      // m of trail left clear after the spawn and before the end
const WIDTH = 3.6;              // gate width: the whole trail
const TIER = (k) => ['Beginner', 'Intermediate', 'Expert'][k];

export function buildMissions(ctx, def, layout, existing = []) {
  const path = layout.path;
  if (!path || def.id === 'hub') return [];
  const hf = ctx.hf, N = path.N, step = path.len / N;
  const h = path.pts.map((p) => hf.baseHeightAt(p.x, p.z));
  const i0 = Math.ceil(START / step), i1 = Math.floor((path.len - END) / step);
  const gate = (i, back = false) => { const p = path.pts[i]; return { x: p.x, z: p.z, yaw: path.yaw(i / N) + (back ? Math.PI : 0), width: WIDTH }; };
  const rings = existing.filter((c) => c.gates?.length).map(ringFor);
  const fits = (g) => { const r = ringFor({ id: '?', gates: [g] }); return rings.every((o) => Math.hypot(o.x - r.x, o.z - r.z) > o.r + r.r + 0.5); };
  const out = [];
  const add = (c) => {
    out.push(c); rings.push(ringFor(c));
    c.gates.forEach((g, k) => {
      if (k === c.gates.length - 1 && c.mission === 'recovery') return;   // (its finish is its start gate)
      ctx.markers.push({ type: k === 0 ? 'start' : k === c.gates.length - 1 ? 'finish' : 'gate', ...g, id: c.id });
    });
  };

  // ---- hill climb: the window of 24-40 m with the most height gain, driven uphill
  let climb = null;
  for (let n = Math.round(24 / step); n <= Math.round(40 / step); n += Math.round(4 / step)) {
    for (let i = i0; i + n <= i1; i += 2) {
      const gain = Math.abs(h[i + n] - h[i]);
      if (gain >= 1.5 && (!climb || gain > climb.gain)) {
        const up = h[i + n] > h[i], a = up ? i : i + n, b = up ? i + n : i;
        if (fits(gate(a, !up))) climb = { gain, a, b, up, len: n * step };
      }
    }
  }
  if (climb) {
    const { a, b, up, gain, len } = climb, m = Math.round((a + b) / 2);
    const k = gain >= 4 ? 2 : gain >= 2.5 ? 1 : 0;
    add({ id: 'mis-climb', mission: 'climb', name: 'Hill Climb', tier: TIER(k), par: Math.round(len / 0.45), rules: { noRollover: true },
      desc: `Climb ${gain.toFixed(1)} m over ${Math.round(len)} m of trail, bottom to top, without rolling over.`,
      gates: [gate(a, !up), gate(m, !up), gate(b, !up)] });
  }

  // ---- checkpoint race: 60-140 m, a checkpoint every ~20 m (at least four of them on a short trail)
  const L = Math.min(140, Math.max(60, path.len * 0.4)), n = Math.max(4, Math.round(L / 20)), span = Math.round(L / step);
  for (const f of [0.08, 0.3, 0.5, 0.2, 0.4, 0.6, 0]) {
    const a = Math.max(i0, Math.round(i0 + (i1 - i0) * f));
    if (a + span > i1 || !fits(gate(a))) continue;
    const gates = Array.from({ length: n + 1 }, (_, k) => gate(a + Math.round((span * k) / n)));
    add({ id: 'mis-race', mission: 'race', name: 'Checkpoint Race', tier: TIER(1), par: Math.round(L / 0.95), rules: {},
      desc: `${Math.round(L)} m of trail against the clock through ${n - 1} checkpoints. Rolling over costs you time, not the run.`, gates });
    break;
  }

  // ---- recovery: a crawler broken down beside the trail ~50 m out; drive to it and bring the news back
  const D = Math.round(50 / step);
  for (const f of [0.55, 0.7, 0.4, 0.85, 0.25]) {
    const far = Math.round(i0 + (i1 - i0) * f), a = far - D;
    if (a < i0 || !fits(gate(a))) continue;
    // beside the trail on whichever side is clear of the rest of the trail (a switchback could pass close by)
    const P = path.pts[far], Nn = path.normal(far / N);
    const side = [1, -1].map((s) => ({ s, x: P.x + Nn.x * s * 2.3, z: P.z + Nn.z * s * 2.3 }))
      .find((q) => path.pts.every((p) => Math.hypot(p.x - q.x, p.z - q.z) > 1.4));
    if (!side) continue;
    const id = 'mis-recovery';
    ctx.markers.push({ type: 'stranded', id, x: side.x, z: side.z, yaw: path.yaw(far / N) + 0.6 * side.s });
    const g0 = gate(a);
    add({ id, mission: 'recovery', name: 'Recovery Run', tier: TIER(1), par: Math.round((2 * D * step) / 0.7), rules: { noRollover: true },
      desc: `A crawler has broken down ${Math.round(D * step)} m up the trail. Drive out to it and back here without rolling over.`,
      gates: [g0, gate(far), { ...g0 }] });
    break;
  }
  return out;
}
