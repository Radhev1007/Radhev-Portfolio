"use client";

import dynamic from "next/dynamic";
import ScrollFloat from "@/components/ScrollFloat/ScrollFloat";

/** WebGPU runs in the browser only, so the galaxy is never rendered on the server. */
const SpiralGalaxy = dynamic(() => import("@/components/SpiralGalaxy/SpiralGalaxy").then((m) => m.SpiralGalaxy), {
  ssr: false,
  loading: () => null,
});

const LINE = "Let's work together";

/**
 * The display line before the contact section, written in stars: vgpu's Spiral Galaxy example with its stars
 * gathering out of the sky into the words as the band comes into view. Where WebGPU is unavailable the line
 * rises in letter by letter instead (React Bits' ScrollFloat, with the usage example's settings).
 */
function Fallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <ScrollFloat
        effect="float"
        splitBy="chars"
        direction="up"
        order="start"
        fromColor="currentColor"
        animationDuration={1}
        ease="back.inOut(2)"
        scrollStart="center bottom+=50%"
        scrollEnd="bottom bottom-=40%"
        stagger={0.03}
        distance={120}
        stretch={2.3}
        smoothing={0}
        containerClassName="!my-0 text-bone"
        textClassName="!leading-[1.1] tracking-[-0.04em]"
      >
        {LINE}
      </ScrollFloat>
    </div>
  );
}

export function FloatBand() {
  return (
    <div className="relative h-[70svh] min-h-[420px] overflow-hidden border-t border-line bg-ink lg:h-[80svh]">
      <div className="gutter mx-auto h-full max-w-[1920px] text-center">
        <SpiralGalaxy
          lines={[LINE]}
          narrowLines={["Let's work", "together"]}
          heading={<h2 className="sr-only">{LINE}</h2>}
          fallback={<Fallback />}
        />
      </div>
    </div>
  );
}
