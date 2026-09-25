"use client";

import { motion } from "framer-motion";
import { ease, viewportOnce } from "@/lib/motion";

/** Thin editorial rule that opens each section: index, label, optional count. */
export function SectionHeader({ index, label, count }: { index: string; label: string; count?: number }) {
  return (
    <div className="relative flex items-center justify-between pb-4">
      <span className="label">
        <span className="text-bone">({index})</span>&nbsp;&nbsp;{label}
      </span>
      {count !== undefined && <span className="label">{String(count).padStart(2, "0")} Projects</span>}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-line"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={viewportOnce}
        transition={{ duration: 1.4, ease: ease.outExpo }}
      />
    </div>
  );
}
