"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useMediaQuery, usePrefersReducedMotion } from "@/lib/hooks";

type Props = {
  children: ReactNode;
  /** Sink back — scale, drift, dim — as the section leaves (off for the last one). */
  exit?: boolean;
};

/**
 * Section-by-section scroll transition. The outgoing section recedes — scales
 * down, drifts back, dims — while the next one, later in the DOM and on an
 * opaque surface, slides over it.
 *
 * The arriving edge used to round and flatten as it landed. With the bands
 * alternating black and white that curve was the most conspicuous thing on
 * the page, so the edge is square now and the colour change does the
 * separating; the hairline it used to carry is redundant for the same
 * reason.
 */
export function SectionScene({ children, exit = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery("(min-width: 768px)", true);
  const k = reduced ? 0 : wide ? 1 : 0.5;

  // 0 → section bottom at the viewport bottom · 1 → section bottom at the viewport top
  const { scrollYProgress: leave } = useScroll({ target: ref, offset: ["end end", "end start"] });

  const scale = useTransform(leave, [0, 1], exit ? [1, 1 - 0.07 * k] : [1, 1]);
  const y = useTransform(leave, [0, 1], exit ? [0, 160 * k] : [0, 0]);
  const opacity = useTransform(leave, [0, 1], exit && k ? [1, 0.3] : [1, 1]);

  return (
    <div ref={ref} className="relative">
      <motion.div
        className="relative overflow-clip bg-ink"
        style={{ scale, y, opacity, transformOrigin: "50% 100%" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
