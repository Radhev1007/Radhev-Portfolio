"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * Colour sets for the two card surfaces. "dark" = the regular card surface,
 * "light" = the inverted (active) card. Both follow the site theme.
 */
const tones = {
  dark: {
    stroke: "color-mix(in srgb, var(--color-bone) 85%, transparent)",
    accent: "var(--color-accent)",
    guide: "color-mix(in srgb, var(--color-accent) 40%, transparent)",
    track: "color-mix(in srgb, var(--color-bone) 25%, transparent)",
    fill: "var(--color-bone)",
  },
  light: {
    stroke: "color-mix(in srgb, var(--color-ink) 85%, transparent)",
    accent: "var(--color-accent-inverse)",
    guide: "color-mix(in srgb, var(--color-accent-inverse) 40%, transparent)",
    track: "color-mix(in srgb, var(--color-ink) 22%, transparent)",
    fill: "var(--color-ink)",
  },
};

/** Small looping diagrams, one per process stage. Purely decorative. */
export function ProcessGlyph({ index, small, tone = "dark" }: { index: number; small?: boolean; tone?: keyof typeof tones }) {
  const { stroke, accent, guide, track, fill } = tones[tone];
  const reduced = usePrefersReducedMotion();
  const loop = (duration = 3) =>
    reduced ? { duration: 0 } : { duration, repeat: Infinity, repeatType: "mirror" as const, ease: "easeInOut" as const };
  const size = small ? 44 : 88;

  const glyphs = [
    // Discover — scattered signals, one gets noticed
    <g key="0">
      {[[20, 24], [62, 18], [34, 60], [70, 64], [48, 38]].map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={i === 4 ? 6 : 3.5} fill={i === 4 ? accent : stroke}
          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ ...loop(2.4), delay: i * 0.3 }} />
      ))}
      <motion.circle cx="48" cy="38" r="16" fill="none" stroke={stroke} style={{ transformBox: "fill-box", transformOrigin: "center" }} animate={{ scale: [0.75, 1.25] }} transition={loop(2)} />
    </g>,
    // Define — many inputs converge on one priority
    <g key="1">
      {[14, 34, 54, 74].map((y, i) => (
        <motion.line key={i} x1="8" y1={y} x2="70" y2="44" stroke={stroke}
          animate={{ pathLength: [0.2, 1] }} transition={{ ...loop(2.2), delay: i * 0.15 }} />
      ))}
      <circle cx="74" cy="44" r="7" fill={accent} />
    </g>,
    // Structure — a simple hierarchy
    <g key="2" stroke={stroke} fill="none">
      <rect x="34" y="8" width="20" height="14" rx="3" />
      {[10, 34, 58].map((x, i) => (
        <motion.g key={i} animate={{ opacity: [0.35, 1] }} transition={{ ...loop(1.8), delay: i * 0.25 }}>
          <path d={`M44 22 V32 H${x + 10} V44`} />
          <rect x={x} y="44" width="20" height="14" rx="3" fill={i === 1 ? accent : "none"} stroke={i === 1 ? accent : stroke} />
        </motion.g>
      ))}
      <path d="M68 58 V72" />
      <rect x="58" y="72" width="20" height="10" rx="3" />
    </g>,
    // Design — components snapping to a grid
    <g key="3">
      {[0, 1, 2].map((i) => (
        <line key={i} x1={18 + i * 26} y1="6" x2={18 + i * 26} y2="82" stroke={guide} />
      ))}
      <motion.rect x="12" y="16" width="64" height="18" rx="9" fill={accent} animate={{ x: [6, 12] }} transition={loop(1.6)} />
      <motion.rect x="12" y="44" width="36" height="30" rx="6" fill="none" stroke={stroke} animate={{ y: [50, 44] }} transition={loop(2)} />
      <rect x="54" y="44" width="22" height="30" rx="6" fill="none" stroke={stroke} />
    </g>,
    // Prototype — a cursor clicking a button
    <g key="4">
      <rect x="10" y="30" width="56" height="22" rx="11" fill="none" stroke={stroke} />
      <motion.rect x="10" y="30" width="56" height="22" rx="11" fill={accent} animate={{ opacity: [0, 0.9, 0] }} transition={reduced ? { duration: 0 } : { duration: 2, repeat: Infinity, times: [0, 0.55, 1] }} />
      <motion.path d="M0 0 V18 L5 13 L9 21 L12 19.5 L8 12 L14 12 Z" fill={fill}
        animate={{ x: [70, 44, 70], y: [70, 40, 70] }} transition={reduced ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }} />
    </g>,
    // Refine — an iteration loop
    <g key="5" fill="none">
      <circle cx="44" cy="44" r="28" stroke={track} />
      <motion.circle cx="44" cy="44" r="28" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeDasharray="44 132"
        animate={{ rotate: reduced ? 0 : 360 }} style={{ originX: "44px", originY: "44px" }}
        transition={reduced ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: "linear" }} />
      <circle cx="44" cy="44" r="5" fill={stroke} />
    </g>,
  ];

  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden className="shrink-0 overflow-visible">
      {glyphs[index]}
    </svg>
  );
}
