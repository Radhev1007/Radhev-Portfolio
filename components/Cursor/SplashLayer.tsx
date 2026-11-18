"use client";

import dynamic from "next/dynamic";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";

/** Loaded only when it is going to be drawn, so the fluid simulation never weighs on the first load. */
const SplashCursor = dynamic(() => import("@/components/SplashCursor/SplashCursor"), { ssr: false });

/**
 * The site-wide splash cursor: your pointer stirs a rainbow ink that curls and fades, and a click bursts a
 * splash. It is a fixed, non-interactive layer, so nothing underneath it stops responding.
 *
 * It runs only for a mouse or trackpad (a touch screen has no cursor to follow, and the simulation is heavy
 * for a phone), and not at all for visitors who ask for reduced motion. It sits at z-index 40, under the
 * header and its menu, so the navigation stays clean.
 */
export function SplashLayer() {
  const finePointer = useFinePointer();
  const reduced = usePrefersReducedMotion();
  if (!finePointer || reduced) return null;
  return <SplashCursor rainbow size={1} force={1} swirl={3} trail={1} clickSplash zIndex={40} />;
}
