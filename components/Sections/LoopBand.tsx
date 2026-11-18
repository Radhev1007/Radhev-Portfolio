"use client";

import TextLoop from "@/components/TextLoop/TextLoop";

/**
 * A ribbon of what I do, flowing along a wave between the work and the approach (React Bits' TextLoop, with the
 * usage example's settings). The loop draws in a 1200×520 box but the wave only fills its middle band, so the
 * wrapper crops it to that band instead of leaving empty space above and below. It eases to a stop under the
 * pointer, and stands still for visitors who ask for reduced motion.
 */
export function LoopBand() {
  return (
    <div className="relative my-16 aspect-[1200/230] overflow-hidden lg:my-24">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
        <TextLoop
          text="Product Design ✦ Design Systems ✦ UX Research ✦ Prototyping"
          shape="wave"
          speed={90}
          direction="forward"
          separator="✦"
          curviness={26}
          tilt={0}
          fontSize={46}
          fontWeight={800}
          letterSpacing={2}
          uppercase
          ribbon
          ribbonColor="#5227FF"
          ribbonWidth={86}
          edgeFade={0}
          cross={false}
          crossAngle={16}
          draggable={false}
          scrollBoost={0}
          outline={false}
          pauseOnHover
        />
      </div>
    </div>
  );
}
