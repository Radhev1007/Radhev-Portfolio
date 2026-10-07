"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { ill } from "./palette";

/** One loop of the "live design session" choreography, in seconds. */
const LOOP = 10;
/** Cursor keyframe times (0…1 of the loop) — every synced element shares these. */
const T = [0, 0.14, 0.2, 0.23, 0.26, 0.44, 0.5, 0.53, 0.56, 0.72, 1];
/** Cursor offsets from its resting spot: rest → cyan swatch (click) → card button (click) → rest. */
const CURSOR_X = [0, -304, -304, -304, -304, -254, -254, -254, -254, 0, 0];
const CURSOR_Y = [0, 190, 190, 190, 190, 28, 28, 28, 28, 0, 0];
const CURSOR_SCALE = [1, 1, 1, 0.82, 1, 1, 1, 0.82, 1, 1, 1];

const PEN_PATH = "M 32 560 C 170 560, 190 420, 300 404 S 470 300, 560 150";

/**
 * Flat hero illustration of a design session in progress: an artboard on a
 * layout grid, a disc, a selected card, a pen-tool curve and a cursor.
 * It assembles after the headline, then plays on a loop — the cursor picks
 * a swatch and the disc recolours, it presses the card's button, a point
 * travels the pen curve and a highlight sweeps the grid. Layers shift
 * slightly with the pointer for depth without 3D.
 */
export function HeroIllustration({ delay = 0 }: { delay?: number }) {
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const live = !reduced;
  const start = delay + 2.4; // loop begins once the entrance has settled

  // Pointer parallax (flat layers, different depths)
  const ref = useRef<SVGSVGElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 60, damping: 18 });
  const sy = useSpring(py, { stiffness: 60, damping: 18 });
  useEffect(() => {
    if (!fine || reduced) return;
    const onMove = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [fine, reduced, px, py]);

  const enter = (d: number, y = 14) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.1, ease: ease.outExpo, delay: delay + d },
        };

  const loop = (times = T) => ({ duration: LOOP, times, repeat: Infinity, ease: "easeInOut" as const, delay: start });

  return (
    <svg
      ref={ref}
      viewBox="0 0 600 640"
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Illustration of a design session: an artboard with a layout grid, a selected card, a pen-tool curve and a cursor choosing colours"
    >
      {/* Ruler with a marker that tracks the cursor */}
      <motion.g {...enter(0, 0)}>
        {Array.from({ length: 43 }, (_, i) => (
          <line key={i} x1={60 + i * 10} y1="36" x2={60 + i * 10} y2={i % 5 === 0 ? 24 : 30} stroke={ill.faint} strokeWidth="1" />
        ))}
        <motion.path
          d="M 450 38 l -5 -8 h 10 Z"
          fill={ill.cyan}
          animate={live ? { x: CURSOR_X } : undefined}
          transition={loop()}
        />
        <text x="60" y="58" fill={ill.grey} fontSize="11" letterSpacing="1.5">FRAME — 01</text>
        <text x="480" y="58" fill={ill.grey} fontSize="11" textAnchor="end" letterSpacing="1.5">1440 × 1024</text>
      </motion.g>

      {/* Artboard + 6-column grid with a sweeping highlight */}
      <Layer x={sx} y={sy} depth={4}>
        <motion.g {...enter(0.05, 20)}>
          <rect x="60" y="70" width="420" height="500" rx="6" fill={ill.surface} stroke={ill.line} />
          {Array.from({ length: 6 }, (_, i) => (
            <motion.rect
              key={i}
              x={76 + i * 66}
              y="70"
              width="56"
              height="500"
              fill={ill.cyan}
              initial={{ opacity: 0.1 }}
              animate={live ? { opacity: [0.1, 0.22, 0.1] } : undefined}
              transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 4.8, delay: start + 0.6 + i * 0.12 }}
            />
          ))}
        </motion.g>
      </Layer>

      {/* Disc — recolours when the cursor picks the cyan swatch */}
      <Layer x={sx} y={sy} depth={10}>
        <motion.g {...enter(0.2, 24)}>
          <circle cx="352" cy="232" r="118" fill={ill.paper} />
          <motion.circle
            cx="352"
            cy="232"
            r="118"
            fill={ill.cyan}
            initial={{ opacity: 0 }}
            animate={live ? { opacity: [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0] } : undefined}
            transition={loop()}
          />
        </motion.g>
      </Layer>

      {/* Heading block — lines "type" and re-set */}
      <Layer x={sx} y={sy} depth={8}>
        <motion.g {...enter(0.3)}>
          <motion.rect x="96" y="112" height="16" rx="3" fill={ill.paper} width="112"
            style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            animate={live ? { scaleX: [1, 1, 0.36, 1] } : undefined}
            transition={{ duration: 3, times: [0, 0.55, 0.7, 1], repeat: Infinity, repeatDelay: 4, ease: ease.inOutQuart, delay: start + 3 }}
          />
          <motion.rect x="96" y="138" height="16" rx="3" fill={ill.paper} width="80"
            style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            animate={live ? { scaleX: [1, 1, 0.25, 1] } : undefined}
            transition={{ duration: 3, times: [0, 0.6, 0.75, 1], repeat: Infinity, repeatDelay: 4, ease: ease.inOutQuart, delay: start + 3.1 }}
          />
          {/* Text caret */}
          <motion.rect x="212" y="110" width="2" height="20" fill={ill.cyan}
            animate={live ? { opacity: [1, 0, 1] } : undefined}
            transition={{ duration: 1, repeat: Infinity, delay: start }}
          />
          <rect x="96" y="172" width="118" height="6" rx="3" fill={ill.faint} />
          <rect x="96" y="186" width="92" height="6" rx="3" fill={ill.faint} />
        </motion.g>
      </Layer>

      {/* Card under selection */}
      <Layer x={sx} y={sy} depth={16}>
        <motion.g {...enter(0.42, 22)}>
          <motion.g animate={live ? { y: [0, -4, 0] } : undefined} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: start }}>
            <rect x="118" y="318" width="270" height="170" rx="14" fill={ill.surface2} />
            <rect x="138" y="338" width="64" height="64" rx="12" fill={ill.surface3} />
            <motion.circle
              cx="170"
              cy="370"
              r="14"
              fill={ill.cyan}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={live ? { scale: [1, 1.14, 1] } : undefined}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: start }}
            />
            <rect x="218" y="346" width="136" height="10" rx="5" fill={ill.paper} />
            <rect x="218" y="366" width="98" height="7" rx="3.5" fill={ill.faint} />
            <rect x="218" y="381" width="118" height="7" rx="3.5" fill={ill.faint} />
            {/* Primary button — pressed by the cursor */}
            <motion.g
              style={{ transformOrigin: "194px 445px", transformBox: "view-box" }}
              animate={live ? { scale: [1, 1, 1, 1, 1, 1, 1, 0.94, 1, 1, 1] } : undefined}
              transition={loop()}
            >
              <rect x="138" y="426" width="112" height="38" rx="19" fill={ill.paper} />
              <motion.rect
                x="138"
                y="426"
                width="112"
                height="38"
                rx="19"
                fill={ill.cyan}
                initial={{ opacity: 0 }}
                animate={live ? { opacity: [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0] } : undefined}
                transition={loop()}
              />
              <rect x="160" y="442" width="68" height="6" rx="3" fill={ill.ink} />
            </motion.g>
            <rect x="262" y="426" width="106" height="38" rx="19" fill="none" stroke={ill.faint} />
            {/* Selection box + handles */}
            <rect x="110" y="310" width="286" height="186" fill="none" stroke={ill.cyan} strokeWidth="1.25" />
            {[
              [110, 310],
              [396, 310],
              [110, 496],
              [396, 496],
              [253, 310],
              [253, 496],
            ].map(([x, y], i) => (
              <g key={i}>
                <rect x={x - 4} y={y - 4} width="8" height="8" fill={ill.ink} stroke={ill.cyan} strokeWidth="1.25" />
                <motion.rect
                  x={x - 4}
                  y={y - 4}
                  width="8"
                  height="8"
                  fill={ill.cyan}
                  initial={{ opacity: 0 }}
                  animate={live ? { opacity: [0, 1, 0] } : undefined}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 5.2, delay: start + 1 + i * 0.08 }}
                />
              </g>
            ))}
            <rect x="318" y="502" width="78" height="20" rx="3" fill={ill.cyan} />
            <text x="357" y="516" fill={ill.ink} fontSize="10" fontWeight="600" textAnchor="middle">286 × 186</text>
          </motion.g>
        </motion.g>
      </Layer>

      {/* Pen-tool curve, anchors, and a point travelling along it */}
      <Layer x={sx} y={sy} depth={22}>
        <motion.path
          d={PEN_PATH}
          fill="none"
          stroke={ill.cyan}
          strokeWidth="2"
          initial={reduced ? undefined : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: ease.inOutQuart, delay: delay + 0.6 }}
        />
        <motion.g {...enter(1.4, 0)}>
          <motion.g
            style={{ transformOrigin: "300px 404px", transformBox: "view-box" }}
            animate={live ? { rotate: [0, -6, 4, 0] } : undefined}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: start }}
          >
            <line x1="230" y1="414" x2="370" y2="394" stroke={ill.grey} strokeWidth="1" />
            <circle cx="230" cy="414" r="4" fill={ill.ink} stroke={ill.grey} />
            <circle cx="370" cy="394" r="4" fill={ill.ink} stroke={ill.grey} />
          </motion.g>
          {[
            [32, 560],
            [300, 404],
            [560, 150],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 5} y={y - 5} width="10" height="10" fill={i === 1 ? ill.cyan : ill.ink} stroke={ill.cyan} strokeWidth="1.5" />
          ))}
          {live && (
            <circle r="4.5" fill={ill.paper}>
              <animateMotion dur="4.5s" begin={`${start}s`} repeatCount="indefinite" path={PEN_PATH} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.65 0 0.35 1" />
            </circle>
          )}
        </motion.g>
      </Layer>

      {/* Swatches — the cyan one registers the click */}
      <motion.g {...enter(1.2, 8)}>
        {[ill.paper, ill.grey, ill.cyan, ill.surface3].map((c, i) => (
          <circle key={c} cx={82 + i * 30} cy="608" r="11" fill={c} stroke={ill.line} />
        ))}
        <motion.circle
          cx="142"
          cy="608"
          r="11"
          fill="none"
          stroke={ill.cyan}
          strokeWidth="1.5"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ opacity: 0 }}
          animate={live ? { opacity: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], scale: [1, 1, 1, 1, 1.8, 1.8, 1, 1, 1, 1, 1] } : undefined}
          transition={loop()}
        />
        <text x="480" y="612" fill={ill.grey} fontSize="11" textAnchor="end" letterSpacing="1.5">AUTO LAYOUT · 24</text>
      </motion.g>

      {/* Cursor + tag — the session's protagonist */}
      <motion.g {...enter(1.6, 10)}>
        <motion.g animate={live ? { x: CURSOR_X, y: CURSOR_Y } : undefined} transition={loop()}>
          <motion.g
            style={{ transformOrigin: "450px 420px", transformBox: "view-box" }}
            animate={live ? { scale: CURSOR_SCALE } : undefined}
            transition={loop()}
          >
            <path d="M 450 420 L 450 462 L 461 452 L 469 470 L 476 467 L 468 449 L 483 449 Z" fill={ill.paper} stroke={ill.ink} strokeWidth="1.5" strokeLinejoin="round" />
          </motion.g>
          <rect x="482" y="468" width="62" height="22" rx="11" fill={ill.cyan} />
          <text x="513" y="483" fill={ill.ink} fontSize="11" fontWeight="600" textAnchor="middle">Design</text>
        </motion.g>
      </motion.g>
    </svg>
  );
}

/** A parallax plane: shifts opposite to the pointer by `depth` px. */
function Layer({ x, y, depth, children }: { x: MotionValue<number>; y: MotionValue<number>; depth: number; children: React.ReactNode }) {
  const tx = useTransform(x, (v) => -v * depth);
  const ty = useTransform(y, (v) => -v * depth);
  return <motion.g style={{ x: tx, y: ty }}>{children}</motion.g>;
}
