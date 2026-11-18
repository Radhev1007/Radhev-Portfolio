"use client";

import dynamic from "next/dynamic";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";

/** Loaded only when it is going to be drawn, so the WebGL glass never weighs on the first load. */
const FluidGlass = dynamic(() => import("@/components/FluidGlass/FluidGlass"), { ssr: false });

/**
 * The site-wide cursor: a lens of liquid glass (React Bits' FluidGlass) that glides after the pointer,
 * stretching as it moves and wobbling as it settles. It is a fixed, non-interactive layer over the page, so
 * nothing underneath stops responding.
 *
 * The glass bends only what is drawn in its own canvas, not the page under it, so what shows is its rim light,
 * highlights and soft shadow. It runs only for a mouse or trackpad, and not for visitors who ask for reduced
 * motion. It sits at z-index 40, under the header and its menu.
 */
export function GlassCursor() {
  const finePointer = useFinePointer();
  const reduced = usePrefersReducedMotion();
  if (!finePointer || reduced) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40">
      <FluidGlass
        text=""
        shape="lens"
        size={80}
        refraction={1}
        dispersion={0.35}
        interaction="follow"
      />
    </div>
  );
}
