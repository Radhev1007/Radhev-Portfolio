"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, intro } from "@/lib/motion";

/** Bottom-centre scroll hint: a hairline with a slow travelling light. */
export function ScrollCue() {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3 md:bottom-9 [@media(max-height:720px)]:hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: intro.nav + 0.2, duration: 1.4 }}
    >
      <span className="label !text-[10px] !text-bone/50">Scroll</span>
      <span className="relative block h-12 w-px overflow-hidden bg-bone/15">
        {!reduced && (
          <motion.span
            className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent via-accent to-transparent"
            animate={{ y: [-16, 48] }}
            transition={{ duration: 2.4, ease: ease.inOutQuart, repeat: Infinity, repeatDelay: 0.6 }}
          />
        )}
      </span>
    </motion.div>
  );
}
