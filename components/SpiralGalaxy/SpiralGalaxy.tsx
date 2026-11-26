"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRenderer } from "./renderer";

type Props = {
  /** Lines the stars settle into; `narrowLines` on tall, narrow frames such as phones. */
  lines: readonly string[];
  narrowLines?: readonly string[];
  /** Shown instead where WebGPU is unavailable or the device fails to start. */
  fallback: ReactNode;
  /** The text for assistive technology (the canvas itself is decorative). */
  heading: ReactNode;
  className?: string;
};

/**
 * vgpu's "Spiral Galaxy" example (`npx vgpu examples pull spiral-galaxy`), with its stars settling into a line of
 * text rather than the spiral (see textField.ts). The renderer, simulation, shaders and teardown are the
 * example's own; this wrapper adds what a section of a long page needs:
 * - the renderer starts when a third of the canvas is on screen, so the visitor sees the stars gather into the
 *   words, and is disposed (GPU device, frame loop, listeners) once it leaves the viewport;
 * - without WebGPU, or if the device fails to start, the fallback is shown instead.
 *
 * Dragging rotates the words in 3D (arrow keys while focused) and hovering scatters the stars, as in the example.
 */
export function SpiralGalaxy({ lines, narrowLines, fallback, heading, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "gpu" in navigator);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !supported || failed) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.33) setActive(true);
        else if (!entry.isIntersecting) setActive(false);
      },
      { threshold: [0, 0.33] },
    );
    io.observe(canvas);
    return () => io.disconnect();
  }, [supported, failed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const renderer = createRenderer({ canvas, text: { lines, narrowLines } });
    // The example's `ready` rejects (after releasing everything) when WebGPU cannot start.
    renderer.ready.catch(() => setFailed(true));
    return () => renderer.dispose();
    // the lines are fixed strings from the caller; restarting on identity changes would replay the intro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (supported === false || failed) return <>{fallback}</>;

  return (
    <>
      {heading}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Star field: drag or use the arrow keys to rotate the words; hover to scatter the stars."
        className={`block h-full w-full outline-none ${className}`}
      />
    </>
  );
}
