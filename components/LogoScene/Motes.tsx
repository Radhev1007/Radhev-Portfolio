"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Studio dust rather than a starfield: a handful of motes at mixed sizes,
 * drifting on their own slow loops and easing away from the cursor.
 *
 * Positions are written straight into the buffer each frame — a few hundred
 * points is far cheaper this way than as instanced meshes.
 */
export function Motes({
  count,
  pointer,
  reduced,
}: {
  count: number;
  pointer: React.RefObject<{ x: number; y: number }>;
  reduced: boolean;
}) {
  const ref = useRef<THREE.Points>(null);

  const { positions, seeds, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
      seeds[i * 3] = Math.random() * Math.PI * 2;
      seeds[i * 3 + 1] = 0.12 + Math.random() * 0.3;
      seeds[i * 3 + 2] = 0.4 + Math.random() * 0.9;
      sizes[i] = 0.012 + Math.random() * 0.03;
    }
    return { positions, seeds, sizes };
  }, [count]);

  const base = useMemo(() => positions.slice(), [positions]);

  useFrame((state) => {
    const pts = ref.current;
    if (!pts || reduced) return;
    const t = state.clock.elapsedTime;
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const p = pointer.current ?? { x: 0, y: 0 };

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const phase = seeds[i3];
      const speed = seeds[i3 + 1];
      const amp = seeds[i3 + 2];

      const x = base[i3] + Math.sin(t * speed + phase) * amp * 0.3;
      const y = base[i3 + 1] + Math.cos(t * speed * 0.8 + phase) * amp * 0.22;

      // Push gently away from the cursor, falling off with distance.
      const dx = x - p.x * 4;
      const dy = y - p.y * 2.4;
      const dist = Math.hypot(dx, dy) || 1;
      const push = Math.min(0.5, 0.9 / (dist * dist));

      arr[i3] = x + (dx / dist) * push;
      arr[i3 + 1] = y + (dy / dist) * push;
      arr[i3 + 2] = base[i3 + 2];
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        sizeAttenuation
        color="#ffffff"
        transparent
        opacity={0.34}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
