// Gateways: the arches that join the hub (Trailhead Valley) to the terrains.
//
// A gateway is { id, to, x, z, yaw, width }: an arch across a trail at (x, z), with `yaw` the direction you
// drive to leave through it and `width` the opening. The hub has one per terrain; every terrain has one
// return gateway, just behind its spawn, back to the hub.
import { smoothstep, lerp } from '../core/noise.js';

const MIN_SPEED = 0.2;   // m/s forward: rolling or reversing through an arch never travels
const MIN_UP = 0.6;      // the truck must be roughly upright

/**
 * Did the truck pass out through gateway `g` between `prev` and `cur` (world x/z)? Only an outward
 * crossing within the opening, driving forward and upright, counts.
 */
export function crossedGateway(g, prev, cur, fwdSpeed, upY) {
  if (fwdSpeed <= MIN_SPEED || upY <= MIN_UP) return false;
  const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
  const d0 = (prev.x - g.x) * fx + (prev.z - g.z) * fz, d1 = (cur.x - g.x) * fx + (cur.z - g.z) * fz;
  if (!(d0 < 0 && d1 >= 0)) return false;
  const lat = (cur.x - g.x) * fz - (cur.z - g.z) * fx;
  return Math.abs(lat) <= g.width / 2;
}

/**
 * The return gateway for a terrain: 4 m behind its spawn, facing away from it, on a pad levelled to the
 * spawn's height (2.5 m round, easing back into the ground over 2 m). Coming back from the hub you arrive
 * at the spawn as usual.
 */
export function placeReturnGateway(ctx, spawn) {
  const hf = ctx.hf;
  const x = spawn.x - Math.sin(spawn.yaw) * 4, z = spawn.z - Math.cos(spawn.yaw) * 4;
  const y = hf.baseHeightAt(spawn.x, spawn.z);
  ctx.forEachNear(x, z, 4.5, (k, px, pz, d) => { hf.base[k] = lerp(y, hf.base[k], smoothstep(2.5, 4.5, d)); });
  return { gateway: { id: 'return', to: 'hub', x, z, yaw: spawn.yaw + Math.PI, width: 3.2 }, arrival: spawn };
}
