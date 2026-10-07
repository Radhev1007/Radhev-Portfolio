"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * The mark, extruded.
 *
 * SVG coordinates run y-down and three's run y-up, so the shapes are flipped
 * and recentred on their own bounding box before extrusion — otherwise the
 * mark orbits a point outside itself and the idle float reads as a wobble.
 */
export function LogoMesh({
  pointer,
  reduced,
  onHoverChange,
}: {
  pointer: React.RefObject<{ x: number; y: number }>;
  reduced: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const press = useRef(0); // 1 at the moment of a click, eased back to 0
  const data = useLoader(SVGLoader, "/logo-mark.svg");

  const geometry = useMemo(() => {
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 13,
      bevelEnabled: true,
      bevelThickness: 1.6,
      bevelSize: 1.4,
      bevelSegments: 5,
      curveSegments: 24,
    });
    geo.center();
    // SVG y-down → three y-up, and scale the 100-unit artboard to ~2 units.
    geo.rotateZ(Math.PI);
    geo.rotateY(Math.PI);
    geo.scale(0.034, 0.034, 0.034);
    geo.computeVertexNormals();
    return geo;
  }, [data]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const d = Math.min(delta, 0.05); // keep a dropped frame from lurching
    const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k * d * 60);

    const p = pointer.current ?? { x: 0, y: 0 };
    const reach = hovered ? 0.42 : 0.26;

    // Idle drift plus cursor lean. Damped rather than tracked, so the mark
    // feels like it has mass instead of being pinned to the pointer.
    const targetY = reduced ? 0 : Math.sin(t * 0.22) * 0.3 + p.x * reach;
    const targetX = reduced ? 0 : Math.sin(t * 0.17) * 0.12 - p.y * reach * 0.6;
    const follow = hovered ? 0.06 : 0.035;

    g.rotation.y = lerp(g.rotation.y, targetY, follow);
    g.rotation.x = lerp(g.rotation.x, targetX, follow);
    g.position.y = reduced ? 0 : lerp(g.position.y, Math.sin(t * 0.5) * 0.06, 0.04);

    press.current = lerp(press.current, 0, 0.05);
    const s = (hovered ? 1.06 : 1) - press.current * 0.08;
    g.scale.setScalar(lerp(g.scale.x, s, 0.08));
    g.rotation.z = lerp(g.rotation.z, press.current * 0.35, 0.06);
  });

  const setHover = (v: boolean) => {
    setHovered(v);
    onHoverChange(v);
    document.body.style.cursor = v ? "pointer" : "";
  };

  return (
    <group ref={group}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={() => setHover(false)}
        onPointerDown={() => (press.current = 1)}
      >
        <meshStandardMaterial
          color="#e9e9e9"
          roughness={hovered ? 0.24 : 0.33}
          metalness={0.28}
          envMapIntensity={hovered ? 1.15 : 0.85}
        />
      </mesh>
    </group>
  );
}
