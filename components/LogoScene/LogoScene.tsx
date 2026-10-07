"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { LogoMesh } from "./LogoMesh";
import { Motes } from "./Motes";

/**
 * The mark as a 3D object in the hero.
 *
 * The canvas takes pointer events, because hover and click are raycast
 * through it; it sits behind the hero content, which keeps its own stacking
 * context, so links and buttons still take their clicks first.
 *
 * Cursor position is kept in a ref and read inside the frame loop. In state
 * it would re-render the React tree on every mouse move.
 */
export function LogoScene({ className = "" }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [tier, setTier] = useState<"high" | "low">("high");

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const narrow = window.innerWidth < 768;
    const cores = navigator.hardwareConcurrency ?? 4;
    setTier(coarse || narrow || cores <= 4 ? "low" : "high");
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const motes = reduced ? 0 : tier === "low" ? 70 : 220;

  return (
    <div className={className} aria-hidden>
      <Canvas
        dpr={tier === "low" ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6.2], fov: 32 }}
        frameloop={reduced ? "demand" : "always"}
      >
        {/* Cinematic studio set: one large soft key, a weak rim behind, and a
            very low fill so the unlit side never goes fully black. */}
        <ambientLight intensity={0.22} />
        <directionalLight position={[4, 5, 6]} intensity={2.4} color="#fff6ee" />
        <directionalLight position={[-6, 2, -4]} intensity={1.1} color="#9fb6ff" />
        <directionalLight position={[0, -4, 2]} intensity={0.35} color="#ffffff" />

        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={0.5} />
          <LogoMesh pointer={pointer} reduced={reduced} onHoverChange={setHovered} />
          {motes > 0 && <Motes count={motes} pointer={pointer} reduced={reduced} />}
        </Suspense>

        {!reduced && <CameraDrift pointer={pointer} hovered={hovered} />}
      </Canvas>
    </div>
  );
}

/**
 * Parallax on the camera rather than the subject, so the mark holds the
 * centre of frame while the viewpoint shifts around it.
 */
function CameraDrift({
  pointer,
  hovered,
}: {
  pointer: React.RefObject<{ x: number; y: number }>;
  hovered: boolean;
}) {
  const { camera } = useThree();
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const k = Math.min(1, 1.6 * d * 60) * 0.03;
    const p = pointer.current ?? { x: 0, y: 0 };
    const reach = hovered ? 0.5 : 0.34;
    camera.position.x += (p.x * reach - camera.position.x) * k;
    camera.position.y += (-p.y * reach * 0.6 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}
