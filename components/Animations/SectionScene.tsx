"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useMediaQuery, usePrefersReducedMotion } from "@/lib/hooks";

type Props = {
  children: ReactNode;
  /** Round and settle the top edge as the section arrives (off for the first section). */
  enter?: boolean;
  /** Sink back — scale, drift, dim — as the section leaves (off for the last one). */
  exit?: boolean;
};

/**
 * Section-by-section scroll transition. The outgoing section recedes (scales
 * down, drifts back, dims) while the next one — later in the DOM, on an
 * opaque surface — slides over it with a rounded top edge that flattens as
 * it lands. Reads like a stack of cards, without any 3D.
 */
export function SectionScene({ children, enter = true, exit = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery("(min-width: 768px)", true);
  const k = reduced ? 0 : wide ? 1 : 0.5;

  // 0 → section top touches the viewport bottom · 1 → section top reaches the viewport top
  const { scrollYProgress: arrive } = useScroll({ target: ref, offset: ["start end", "start start"] });
  // 0 → section bottom at the viewport bottom · 1 → section bottom at the viewport top
  const { scrollYProgress: leave } = useScroll({ target: ref, offset: ["end end", "end start"] });

  const radius = useTransform(arrive, [0, 1], enter && k ? [48 * k, 0] : [0, 0]);
  const scale = useTransform(leave, [0, 1], exit ? [1, 1 - 0.07 * k] : [1, 1]);
  const y = useTransform(leave, [0, 1], exit ? [0, 160 * k] : [0, 0]);
  const opacity = useTransform(leave, [0, 1], exit && k ? [1, 0.3] : [1, 1]);

  return (
    <div ref={ref} className="relative">
      <motion.div
        className={`relative overflow-clip bg-ink ${enter ? "border-t border-line" : ""}`}
        style={{ scale, y, opacity, borderTopLeftRadius: radius, borderTopRightRadius: radius, transformOrigin: "50% 100%" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
