"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { intro, transition } from "@/lib/motion";

/**
 * The hero portrait.
 *
 * The source has a flat #252729 background, which would read as a grey card
 * on a pure-black page. Rather than key it out — the subject's hair is nearly
 * black, and keying that against a dark background leaves a halo — the black
 * point is corrected when the WebP is produced, so the frame has no edge to
 * see. What that cannot fix is the bottom, where the shoulders are cropped
 * mid-tone and would end in a hard line against the page; that is the mask.
 *
 * The frame is sized from its height and squared with aspect-ratio rather
 * than left to `w-auto`. A replaced element with auto dimensions lays out
 * from whatever the browser decoded, so a half-loaded or downscaled variant
 * silently changes the design — which it did.
 */
export function HeroPortrait() {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      className="flex size-full items-end justify-center md:justify-end"
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition(intro.objects, 1.3)}
    >
      <div
        className="relative aspect-square h-full max-h-[260px] md:max-h-[420px]"
        style={{
          // Both spellings: Safari dropped the prefix recently enough that it
          // is not worth finding out which build a visitor is on.
          WebkitMaskImage: "linear-gradient(to bottom, #000 66%, transparent 98%)",
          maskImage: "linear-gradient(to bottom, #000 66%, transparent 98%)",
        }}
      >
        <Image
          src="/radhev-portrait.webp"
          alt="Radhev R"
          fill
          priority
          sizes="(min-width: 768px) 420px, 260px"
          // Served as authored. The file is already a 16 kB WebP at its
          // native 500px, so the optimiser has nothing to win — and its AVIF
          // and JPEG re-encodes lift the background from a true 0 to 4/255,
          // which on a pure-black page and an OLED screen is a faintly lit
          // rectangle where the photo should have no edge at all.
          unoptimized
          className="object-contain"
        />
      </div>
    </motion.div>
  );
}
