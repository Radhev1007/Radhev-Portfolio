"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";

/** The beam is WebGL, drawn in the browser only. */
const LaserFlow = dynamic(() => import("@/components/LaserFlow/LaserFlow"), { ssr: false });

/**
 * The contact details on an invisible card (the page's own black, no border) that a beam of light drops onto
 * from above, so the light reads as landing on a horizon, its glow running along the
 * card's top edge and spilling over the corners (React Bits' LaserFlow, with the usage example's settings).
 * Near the pointer the light picks out a project screen through the haze. The card's links sit above the
 * light and stay fully usable.
 */
export function LaserCard({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative mt-12 overflow-hidden pt-[200px] lg:pt-[240px]">
      <div aria-hidden className="absolute inset-0">
        <LaserFlow
          surfaceRef={cardRef}
          beamPosition={0.6}
          color="#3847ff"
          intensity={1.8}
          flare={1.5}
          spread={1.5}
          spill={1}
          fog={0.2}
          dust={1.6}
          revealImage="/projects/dilmon-property-dashboard.jpg"
          revealRadius={220}
          revealOpacity={0.6}
        />
      </div>
      <div ref={cardRef} className="relative z-10 rounded-[14px] bg-ink pt-6 sm:pt-8">
        {children}
      </div>
    </div>
  );
}
