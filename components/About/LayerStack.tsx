"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { ill } from "@/components/Illustrations/palette";
import { usePrefersReducedMotion } from "@/lib/hooks";

const layers = [
  { name: "Structure", note: "Grid & hierarchy" },
  { name: "Wireframe", note: "Layout & flow" },
  { name: "Visual", note: "Type, colour, imagery" },
  { name: "Interaction", note: "States & motion" },
];

/**
 * One interface split into its layers — structure, wireframe, visual,
 * interaction — drawn flat and offset like sheets of tracing paper. The
 * sheets fan apart as the section scrolls into view.
 */
export function LayerStack() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const spread = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.2, 1]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[620px]">
      <svg viewBox="0 0 620 560" className="h-auto w-full" role="img" aria-label="An interface separated into four layers: structure, wireframe, visual and interaction">
        {layers.map((l, i) => (
          <Sheet key={l.name} index={i} spread={spread} name={l.name} note={l.note} />
        ))}
      </svg>
    </div>
  );
}

function Sheet({ index, spread, name, note }: { index: number; spread: MotionValue<number>; name: string; note: string }) {
  // Back sheet (index 0) sits top-left; each subsequent sheet steps down-right.
  const x = useTransform(spread, (s) => index * 46 * s);
  const y = useTransform(spread, (s) => index * 70 * s);
  const W = 300;
  const H = 330;

  return (
    <motion.g style={{ x, y }}>
      <g transform="translate(40 20)">
        {index === 0 && (
          <>
            <rect width={W} height={H} rx="12" fill={ill.surface} stroke={ill.line} />
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={16 + i * 46} y="0" width="38" height={H} fill={ill.cyanSoft} />
            ))}
          </>
        )}
        {index === 1 && (
          <>
            <rect width={W} height={H} rx="12" fill={ill.surface2} stroke={ill.line} />
            <rect x="24" y="26" width="110" height="10" rx="5" fill={ill.faint} />
            <rect x="24" y="54" width="252" height="120" rx="8" fill="none" stroke={ill.faint} strokeDasharray="5 5" />
            <path d="M 24 54 L 276 174 M 276 54 L 24 174" stroke={ill.line} />
            {[0, 1, 2].map((i) => (
              <rect key={i} x="24" y={196 + i * 18} width={240 - i * 50} height="7" rx="3.5" fill={ill.line} />
            ))}
            <rect x="24" y="270" width="120" height="34" rx="17" fill="none" stroke={ill.faint} />
          </>
        )}
        {index === 2 && (
          <>
            <rect width={W} height={H} rx="12" fill={ill.surface3} />
            <rect x="24" y="26" width="110" height="10" rx="5" fill={ill.paper} />
            <rect x="24" y="54" width="252" height="120" rx="8" fill={ill.paper} />
            <circle cx="210" cy="114" r="36" fill={ill.cyan} />
            {[0, 1].map((i) => (
              <rect key={i} x="24" y={196 + i * 18} width={220 - i * 70} height="7" rx="3.5" fill={ill.faint} />
            ))}
            <rect x="24" y="270" width="120" height="34" rx="17" fill={ill.paper} />
          </>
        )}
        {index === 3 && (
          <>
            <rect width={W} height={H} rx="12" fill="none" stroke={ill.cyan} strokeDasharray="2 6" />
            <rect x="20" y="266" width="128" height="42" rx="21" fill="none" stroke={ill.cyan} strokeWidth="2" />
            <path d="M 132 282 L 132 310 L 139 303 L 145 316 L 150 314 L 144 301 L 154 301 Z" fill={ill.paper} stroke={ill.ink} strokeWidth="1.25" strokeLinejoin="round" />
            <rect x="214" y="20" width="66" height="22" rx="11" fill={ill.cyan} />
            <text x="247" y="35" fill={ill.ink} fontSize="11" fontWeight="600" textAnchor="middle">hover</text>
          </>
        )}
        {/* Label */}
        <g transform={`translate(${W + 14} ${index === 3 ? H - 20 : 16})`}>
          <line x1="0" y1="-4" x2="18" y2="-4" stroke={ill.faint} />
          <text x="26" y="0" fill={ill.paper} fontSize="12" fontWeight="500" letterSpacing="1.2">
            {name.toUpperCase()}
          </text>
          <text x="26" y="16" fill={ill.grey} fontSize="11">
            {note}
          </text>
        </g>
      </g>
    </motion.g>
  );
}
