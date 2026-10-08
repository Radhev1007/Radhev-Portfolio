"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { intro, transition } from "@/lib/motion";

/**
 * The hero portrait.
 *
 * The source has a flat #252729 background, which on a pure-black page would
 * read as a grey card. Keying it out was the wrong tool — the subject's hair
 * is nearly black and keying that against a dark background leaves a halo —
 * so the black point is corrected when the WebP is produced, mapping the
 * background to a true 0. The bottom is masked because the shoulders are
 * cropped mid-tone and would otherwise end in a hard line across the page.
 *
 * The frame is sized from its height and squared with aspect-ratio rather
 * than left to `w-auto`. A replaced element with auto dimensions lays out
 * from whatever the browser decoded, so a half-loaded or downscaled variant
 * silently changes the design — which it did.
 *
 * Motion, in the order you meet it: the photograph wipes up on load, then
 * leans toward the cursor on a spring, over a slow accent glow. The lean is
 * small on purpose — enough that the picture feels lit and present rather
 * than pasted on, not so much that it reads as a gimmick.
 */

const SPRING = { stiffness: 70, damping: 20, mass: 0.7 };
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function HeroPortrait() {
  const reduced = usePrefersReducedMotion();
  const frame = useRef<HTMLDivElement>(null);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const sx = useSpring(pointerX, SPRING);
  const sy = useSpring(pointerY, SPRING);

  const x = useTransform(sx, (v) => v * 22);
  const y = useTransform(sy, (v) => v * 14);
  const rotateY = useTransform(sx, (v) => v * 7);
  const rotateX = useTransform(sy, (v) => v * -6);
  const glowShift = useTransform(sx, (v) => `${50 + v * 16}%`);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: PointerEvent) => {
      // Touch has no hover, and a tap should not fling the portrait sideways.
      if (e.pointerType === "touch") return;
      const r = frame.current?.getBoundingClientRect();
      if (!r) return;
      pointerX.set(clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      pointerY.set(clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduced, pointerX, pointerY]);

  return (
    <div className="flex size-full items-end justify-center md:justify-end">
      <motion.div
        ref={frame}
        className="relative aspect-square h-full max-h-[320px] md:max-h-[520px]"
        style={{ x, y, rotateX, rotateY, transformPerspective: 900 }}
      >
        {/* Sits outside the clip so it is not wiped in with the photograph. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[14%]"
          style={{
            background: `radial-gradient(circle at ${"var(--glow-x, 50%)"} 44%, rgb(244 60 0 / 0.17), transparent 62%)`,
            ["--glow-x" as string]: glowShift,
          }}
          animate={reduced ? undefined : { opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute inset-0"
          style={{
            // Both spellings: Safari dropped the prefix recently enough that
            // it is not worth finding out which build a visitor is on.
            WebkitMaskImage: "linear-gradient(to bottom, #000 66%, transparent 98%)",
            maskImage: "linear-gradient(to bottom, #000 66%, transparent 98%)",
          }}
          initial={{ opacity: 0, clipPath: "inset(100% 0% 0% 0%)" }}
          animate={{ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
          transition={transition(intro.objects, reduced ? 0.4 : 1.4)}
        >
          <Image
            src="/radhev-portrait.webp"
            alt="Radhev R"
            fill
            priority
            sizes="(min-width: 768px) 520px, 320px"
            // Served as authored. It is already a 32 kB WebP at the size the
            // page asks for, so the optimiser has nothing to win — and its
            // AVIF and JPEG re-encodes lift the background from a true 0 to
            // 4/255, which on a pure-black page and an OLED screen is a
            // faintly lit rectangle where the photo should have no edge.
            unoptimized
            className="object-contain"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
