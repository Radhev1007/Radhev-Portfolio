"use client";

import dynamic from "next/dynamic";
import ScrollFloat from "@/components/ScrollFloat/ScrollFloat";
import StarBorder from "@/components/StarBorder/StarBorder";

/** WebGPU runs in the browser only, so the galaxy is never rendered on the server. */
const SpiralGalaxy = dynamic(() => import("@/components/SpiralGalaxy/SpiralGalaxy").then((m) => m.SpiralGalaxy), {
  ssr: false,
  loading: () => null,
});

const LINE = "Let's work together";
const PHONE = "tel:+918089821700";

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
      {/* the call to action under the starry line, the same star-bordered pill as the hero's buttons */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[14%] z-10 flex justify-center lg:bottom-[18%]">
        <StarBorder
          as="a"
          href={PHONE}
          radius={999}
          color="var(--color-bone)"
          backgroundColor="var(--color-ink)"
          textColor="var(--color-bone)"
          borderColor="var(--color-line-strong)"
          className="group pointer-events-auto h-11 gap-2.5 !px-6 !py-0 text-[length:var(--text-ui)] !leading-none"
        >
          Let&apos;s Talk
          <span aria-hidden className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
        </StarBorder>
      </div>
    </div>
  );
}
