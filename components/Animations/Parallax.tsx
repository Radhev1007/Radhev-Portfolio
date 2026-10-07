"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useMediaQuery, usePrefersReducedMotion } from "@/lib/hooks";

type Props = { children: ReactNode; speed?: number; className?: string };

/**
 * Translates children relative to scroll, so layers inside a section move at
 * different rates. `speed` is px of travel either side of rest (positive =
 * drifts up faster than the page, negative = lags behind). Halved on phones,
 * off for reduced motion.
 */
export function Parallax({ children, speed = 80, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery("(min-width: 768px)", true);
  const s = reduced ? 0 : wide ? speed : speed / 2;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [s, -s]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
