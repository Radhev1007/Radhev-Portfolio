// Challenge rings: every challenge's start, marked in the world so it can be found by driving around. A
// glowing ring on the ground in the tier's colour, a tall light column visible across the map, and a medal
// disc above it once a medal is won. Drive into a ring and the game offers to start that challenge.
import * as THREE from 'three';

export const TIER_COLOR = { Beginner: 0x3ccf6e, Intermediate: 0xf5a623, Expert: 0xe5484d };
const MEDAL_COLOR = { gold: 0xf2c94c, silver: 0xd6dbe0, bronze: 0xc98a52 };

/** Where and how big challenge `c`'s ring is: on its start gate, a little wider than the gate. */
export function ringFor(c) {
  const g = c.gates[0];
  return { id: c.id, x: g.x, z: g.z, r: Math.max(1.6, g.width / 2 + 0.4), tier: c.tier || 'Intermediate' };
}

/** The closest ring that (x, z) is inside, or null. */
export function nearestRing(rings, x, z) {
  let best = null, bd = Infinity;
  for (const r of rings) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d <= r.r && d < bd) { best = r; bd = d; }
  }
  return best;
}

/**
 * Rings for all of `level`'s challenges. `update` returns the ring the truck is in while no challenge is
 * armed or running (that is when the prompt shows); `refresh` re-reads medals after a finish.
 */
export function buildRings(level, challenges) {
  const group = new THREE.Group(); group.name = 'challengeRings';
  const hf = level.hf;
  const beaconGeo = new THREE.CylinderGeometry(0.5, 0.5, 6, 20, 1, true); beaconGeo.translate(0, 3, 0);
  const discGeo = new THREE.CircleGeometry(0.32, 24);
  const rings = level.challenges.filter((c) => c.gates?.length).map((c) => {
    const ring = ringFor(c);
    const col = TIER_COLOR[ring.tier] ?? TIER_COLOR.Intermediate;
    const y = hf.heightAt(ring.x, ring.z) + 0.06;
    const g = new THREE.Group(); g.position.set(ring.x, y, ring.z);
    const band = new THREE.Mesh(new THREE.RingGeometry(ring.r - 0.14, ring.r, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    band.rotation.x = -Math.PI / 2;
    const beacon = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.scale.set(ring.r / 1.6 * 0.6, 1, ring.r / 1.6 * 0.6);
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    disc.position.y = 6.4; disc.visible = false;
    g.add(band, beacon, disc);
    group.add(g);
    return Object.assign(ring, { c, band, beacon, disc, medal: null });
  });
  let t = 0;
  const api = {
    group, rings,
    refresh() {
      for (const r of rings) {
        r.medal = challenges.medalOf(r.c);
        r.disc.visible = !!r.medal;
        if (r.medal) r.disc.material.color.setHex(MEDAL_COLOR[r.medal] ?? 0xffffff);
      }
    },
    update(dt, phys, camera) {
      t += dt;
      const busy = !!challenges.active;
      for (const r of rings) {
        const mine = challenges.active?.id === r.id;
        r.band.material.opacity = busy && !mine ? 0.2 : 0.65 + Math.sin(t * 3) * 0.2;
        r.beacon.material.opacity = busy && !mine ? 0.04 : 0.18;
        if (camera && r.disc.visible) r.disc.lookAt(camera.position);
      }
      if (busy || !phys) return null;
      return nearestRing(rings, phys.pos.x, phys.pos.z);
    },
  };
  api.refresh();
  return api;
}
