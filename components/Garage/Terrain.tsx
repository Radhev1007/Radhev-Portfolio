"use client";

import { HeightfieldCollider, RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import {
  buildHeights,
  heightAt,
  normalAt,
  PLACES,
  TERRAIN_SEGS,
  TERRAIN_SIZE,
} from "./heightfield";

/**
 * The ground.
 *
 * The mesh is built vertex by vertex from `heightAt` rather than by displacing
 * a PlaneGeometry, so there is no rotation convention to get wrong, and the
 * collider is a Rapier heightfield sampled from the same function. One source
 * of truth means the line you can see is the line you can drive.
 *
 * Colour is painted per vertex from slope, height and proximity to the stream
 * — rock where it is steep, gravel on the graded pads, wet dirt along the
 * water, moss on the flat shelves. No textures, so nothing to download.
 */

const DIRT = new THREE.Color("#3b3127");
const ROCK = new THREE.Color("#4e4941");
const ROCK_HI = new THREE.Color("#6a655b");
const GRAVEL = new THREE.Color("#554d41");
const WET = new THREE.Color("#241d16");
const MOSS = new THREE.Color("#3a4229");

function surfaceColour(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  out.copy(DIRT);

  // Graded pads read as laid gravel.
  const onPad =
    1 - Math.min(1, Math.hypot(x - PLACES.trailhead.x, z - PLACES.trailhead.z) / 11) +
    (1 - Math.min(1, Math.hypot(x - PLACES.pit.x, z - PLACES.pit.z) / 9));
  out.lerp(GRAVEL, Math.min(0.85, Math.max(0, onPad)));

  // Rock takes over as the ground steepens, and lightens as it rises.
  out.lerp(ROCK, Math.min(1, Math.max(0, (slope - 0.12) * 3.4)));
  out.lerp(ROCK_HI, Math.min(0.6, Math.max(0, (h - 4) / 7)));

  // Moss on the damp flats, wet ground in the stream bed.
  if (slope < 0.1 && h > -0.6 && h < 2.4) {
    out.lerp(MOSS, 0.22 * (0.4 + ((x * 0.7 + z * 1.3) % 1 > 0.55 ? 0.6 : 0)));
  }
  if (h < -0.35) out.lerp(WET, Math.min(0.9, (-0.35 - h) * 1.1));
  return out;
}

export function Terrain() {
  const geometry = useMemo(() => {
    const n = TERRAIN_SEGS + 1;
    const half = TERRAIN_SIZE / 2;
    const positions = new Float32Array(n * n * 3);
    const normals = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const c = new THREE.Color();

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = -half + (i / TERRAIN_SEGS) * TERRAIN_SIZE;
        const z = -half + (j / TERRAIN_SEGS) * TERRAIN_SIZE;
        const h = heightAt(x, z);
        positions[k * 3] = x;
        positions[k * 3 + 1] = h;
        positions[k * 3 + 2] = z;

        const nrm = normalAt(x, z);
        normals[k * 3] = nrm[0];
        normals[k * 3 + 1] = nrm[1];
        normals[k * 3 + 2] = nrm[2];

        surfaceColour(x, z, h, 1 - nrm[1], c);
        colors[k * 3] = c.r;
        colors[k * 3 + 1] = c.g;
        colors[k * 3 + 2] = c.b;
      }
    }

    const index = new Uint32Array(TERRAIN_SEGS * TERRAIN_SEGS * 6);
    let t = 0;
    for (let j = 0; j < TERRAIN_SEGS; j++) {
      for (let i = 0; i < TERRAIN_SEGS; i++) {
        const a = j * n + i;
        const b = a + 1;
        const d = a + n;
        const e = d + 1;
        index[t++] = a;
        index[t++] = d;
        index[t++] = b;
        index[t++] = b;
        index[t++] = d;
        index[t++] = e;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    return g;
  }, []);

  const heights = useMemo(() => Array.from(buildHeights()), []);

  return (
    <RigidBody type="fixed" friction={1.5} colliders={false}>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.97} metalness={0} />
      </mesh>
      {/* Rapier scales the samples into these extents; the heights are already
          in world units, so only x and z are scaled. */}
      <HeightfieldCollider
        args={[TERRAIN_SEGS, TERRAIN_SEGS, heights, { x: TERRAIN_SIZE, y: 1, z: TERRAIN_SIZE }]}
      />
    </RigidBody>
  );
}
