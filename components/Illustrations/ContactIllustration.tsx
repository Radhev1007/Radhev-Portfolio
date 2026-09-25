"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, viewportOnce } from "@/lib/motion";
import { ill } from "./palette";

/** Two speech bubbles meeting — a conversation starting — with a cursor about to reply. */
export function ContactIllustration() {
  const reduced = usePrefersReducedMotion();
  const pop = (d: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, scale: 0.9 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: viewportOnce,
          transition: { duration: 0.9, ease: ease.outExpo, delay: d },
        };

  return (
    <svg viewBox="0 0 320 170" className="h-auto w-full" aria-hidden>
      <motion.g {...pop(0)} style={{ transformOrigin: "110px 70px" }}>
        <path d="M 30 20 H 190 a 16 16 0 0 1 16 16 V 96 a 16 16 0 0 1 -16 16 H 74 L 46 136 V 112 H 30 a 16 16 0 0 1 -16 -16 V 36 a 16 16 0 0 1 16 -16 Z" fill={ill.paper} />
        <rect x="38" y="46" width="128" height="9" rx="4.5" fill={ill.ink} />
        <rect x="38" y="66" width="92" height="9" rx="4.5" fill={ill.grey} />
      </motion.g>
      <motion.g {...pop(0.25)} style={{ transformOrigin: "240px 110px" }}>
        <path d="M 190 78 H 290 a 14 14 0 0 1 14 14 V 132 a 14 14 0 0 1 -14 14 H 280 V 164 L 258 146 H 190 a 14 14 0 0 1 -14 -14 V 92 a 14 14 0 0 1 14 -14 Z" fill={ill.cyan} />
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={216 + i * 22}
            cy="112"
            r="5"
            fill={ill.ink}
            animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </motion.g>
    </svg>
  );
}
