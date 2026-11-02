// Soft-tyre squash, drawn. The physics lets each tyre squash toward its rim under load (TYRE_PRESSURE in
// physics/vehicle.js), so the drawn hub sits that much closer to the ground than a rigid tyre would. This
// vertex patch flattens whatever of the tyre then reaches past the ground onto the contact plane, and bulges
// the sidewalls out around the flattened patch, the way a low-pressure crawler tyre wraps a rock.
//
// It works in world space against the contact plane, so the wheel's spin and steer don't matter, and it
// applies to any wheel model on the hubs (the RC tyre or a body's own wheels). Each wheel gets its own
// material copies, because the plane is per wheel; they share one shader program.
import * as THREE from 'three';

const VERT_HEAD = 'uniform vec4 uTyrePlane;\nuniform float uTyreOn;\nuniform float uTyreBulge;\n';
const VERT_BODY = `
  if (uTyreOn > 0.5) {
    vec4 tyW = modelMatrix * vec4(transformed, 1.0);
    float tyD = dot(tyW.xyz, uTyrePlane.xyz) - uTyrePlane.w;   // height above the ground plane
    vec3 tyAx = normalize(modelMatrix[0].xyz);                 // the axle (the tyre's axis is its local X)
    float tyA = dot(tyW.xyz - modelMatrix[3].xyz, tyAx);       // how far out along the axle, from the hub
    tyW.xyz += uTyrePlane.xyz * max(0.0, -tyD);                // flatten onto the ground
    float tyNear = 1.0 - smoothstep(0.0, 0.07, max(tyD, 0.0)); // the patch and just above it
    tyW.xyz += tyAx * sign(tyA) * uTyreBulge * tyNear * clamp(abs(tyA) / 0.06, 0.0, 1.0);
    transformed = (inverse(modelMatrix) * tyW).xyz;
  }
`;

function patchMaterial(src, U) {
  const m = src.clone();
  const baseCompile = src.onBeforeCompile, baseKey = src.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    baseCompile.call(src, shader, renderer);
    shader.uniforms.uTyrePlane = U.plane;
    shader.uniforms.uTyreOn = U.on;
    shader.uniforms.uTyreBulge = U.bulge;
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
  };
  m.customProgramCacheKey = () => baseKey.call(src) + '|tyreSquash';
  return m;
}

/** Give every mesh on one wheel (under `root`) a squash-capable material; returns the wheel's uniforms. */
export function prepareWheel(root, U = { plane: { value: new THREE.Vector4(0, 1, 0, -1e6) }, on: { value: 0 }, bulge: { value: 0 } }) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || o.userData.tyreSquash) return;
    if (o.material.colorWrite === false) return;   // shadow stand-ins
    o.material = Array.isArray(o.material) ? o.material.map((mt) => patchMaterial(mt, U)) : patchMaterial(o.material, U);
    o.userData.tyreSquash = true;
  });
  return U;
}

/**
 * Per frame: wheel i touching the ground at point p with normal n (world), squashed `defl` metres.
 * Off the ground, the patch is switched off.
 */
export function setWheelContact(U, contact, p, n, defl) {
  if (!contact || defl <= 0.0005) { U.on.value = 0; return; }
  U.on.value = 1;
  U.plane.value.set(n.x, n.y, n.z, n.x * p.x + n.y * p.y + n.z * p.z);
  U.bulge.value = Math.min(0.02, defl * 0.35);
}
