"use client";

import dynamic from "next/dynamic";

/** The WebGL dither is drawn in the browser only; the box keeps its size while it loads. */
const DitherVeil = dynamic(() => import("@/components/DitherVeil/DitherVeil"), { ssr: false });

/**
 * My portrait as a 1-bit dither (React Bits' DitherVeil). The pointer opens a full-colour window that knits
 * back into the dither as it moves on; a click or tap sends a ring of colour across it.
 */
export function Portrait({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Portrait of Radhev R"
      className={`relative aspect-[1181/1331] w-full overflow-hidden rounded-card bg-[#e9e9e9] ${className}`}
    >
      <DitherVeil
        src="/radhev.webp"
        fit="cover"
        pattern="floyd"
        pixelSize={2}
        inkColor="#0a0a0a"
        paperColor="#e9e9e9"
        revealRadius={140}
        softness={0.6}
        linger={1}
      />
    </div>
  );
}
