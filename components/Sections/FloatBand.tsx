"use client";

import ScrollFloat from "@/components/ScrollFloat/ScrollFloat";

/**
 * A display line before the contact section that rises letter by letter as it scrolls in (React Bits'
 * ScrollFloat, with the usage example's settings). The component sizes the text from the viewport width.
 */
export function FloatBand() {
  return (
    <div className="gutter mx-auto max-w-[1920px] border-t border-line py-16 text-center lg:py-24">
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
        Let&apos;s work together
      </ScrollFloat>
    </div>
  );
}
