"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

/**
 * Hero visual: a design editor mid-session.
 *
 * A generic canvas tool — toolbar, layers, canvas, properties — rather than
 * any one product's UI, drawn in the site's own palette. On the canvas sits a
 * dashboard being built. On a loop the selection moves between a KPI card,
 * the chart and the table; the matching layer lights up, the properties
 * panel updates, my cursor follows the selection and a collaborator's
 * cursor wanders the canvas. Square corners throughout, like the site.
 *
 * Everything is one SVG on a 600×480 box so it scales as a single drawing.
 */

const ACCENT = "#f43c00";
const WHITE = "#ffffff";
const PANEL = "#0d0d0d";
const SURFACE = "#141414";
const RAISED = "#1f1f1f";
const LINE = "#262626";
const MUTE = "#8a8a8a";
const FAINT = "#3a3a3a";

/** Frame on the canvas. */
const F = { x: 150, y: 74, w: 300, h: 250 };

type Target = {
  layer: number;
  name: string;
  box: { x: number; y: number; w: number; h: number };
  size: [number, number];
  fill: string;
  gap: number;
};

const TARGETS: Target[] = [
  { layer: 3, name: "KPI card", box: { x: 284, y: 108, w: 76, h: 46 }, size: [152, 92], fill: "1A1A1A", gap: 12 },
  { layer: 4, name: "Revenue chart", box: { x: 200, y: 162, w: 244, h: 86 }, size: [488, 172], fill: "141414", gap: 24 },
  { layer: 5, name: "Table", box: { x: 200, y: 256, w: 244, h: 60 }, size: [488, 120], fill: "101010", gap: 8 },
];

const LAYERS = ["Dashboard", "Sidebar", "Header", "KPI cards", "Revenue chart", "Table"];

/** Where the collaborator's cursor drifts, one point per beat. */
const DEV_PATH = [
  { x: 236, y: 300 },
  { x: 410, y: 128 },
  { x: 196, y: 132 },
];

const STEP_MS = 2800;

export function HeroEditor({ delay = 0 }: { delay?: number }) {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(1);

  useEffect(() => {
    if (reduced) return;
    let id: number | undefined;
    // Start cycling once the entrance has settled.
    const start = window.setTimeout(() => {
      id = window.setInterval(() => setI((n) => (n + 1) % TARGETS.length), STEP_MS);
    }, (delay + 1.6) * 1000);
    return () => {
      window.clearTimeout(start);
      if (id) window.clearInterval(id);
    };
  }, [reduced, delay]);

  const t = TARGETS[i];
  const b = t.box;
  const dev = DEV_PATH[i];
  const flip = b.x + b.w > 420;
  const spring = { duration: 0.9, ease: ease.outExpo };

  const enter = (d: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: ease.outExpo, delay: delay + d },
        };

  const handles = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ];

  return (
    <svg
      viewBox="0 0 600 480"
      className="h-auto w-full"
      role="img"
      aria-label="A design editor with a dashboard being designed: layers on the left, properties on the right"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <defs>
        <pattern id="hero-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#1c1c1c" />
        </pattern>
      </defs>

      {/* Window */}
      <motion.g {...enter(0)}>
        <rect x="0.5" y="0.5" width="599" height="479" fill={PANEL} stroke={LINE} />
        <rect x="130" y="36" width="340" height="444" fill="#060606" />
        <rect x="130" y="36" width="340" height="444" fill="url(#hero-dots)" />
      </motion.g>

      {/* Toolbar */}
      <motion.g {...enter(0.05)}>
        <line x1="0" y1="36" x2="600" y2="36" stroke={LINE} />
        {/* move */}
        <rect x="10" y="7" width="22" height="22" fill={ACCENT} />
        <path d="M17 12 L17 24 L20 21 L22.5 26 L24.5 25 L22 20 L26 20 Z" fill={WHITE} />
        {/* frame */}
        <path d="M44 12 V25 M51 12 V25 M40 15 H55 M40 22 H55" stroke={MUTE} strokeWidth="1.3" />
        {/* rectangle */}
        <rect x="66" y="12" width="12" height="12" fill="none" stroke={MUTE} strokeWidth="1.3" />
        {/* pen */}
        <path d="M92 25 L96 13 L100 25 M93.5 21 H98.5" stroke={MUTE} strokeWidth="1.3" fill="none" />
        {/* text */}
        <path d="M112 13 H124 M118 13 V25" stroke={MUTE} strokeWidth="1.3" />
        <text x="300" y="22" textAnchor="middle" fontSize="10" fill={MUTE}>
          Portfolio / <tspan fill={WHITE}>Admin dashboard</tspan>
        </text>
        {/* collaborators */}
        <circle cx="504" cy="18" r="9" fill={ACCENT} />
        <text x="504" y="21.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={WHITE}>R</text>
        <circle cx="520" cy="18" r="9" fill="#5b5b5b" stroke={PANEL} strokeWidth="2" />
        <text x="520" y="21.5" textAnchor="middle" fontSize="9" fontWeight="600" fill={WHITE}>D</text>
        <rect x="540" y="9" width="50" height="18" fill={WHITE} />
        <text x="565" y="21.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="#000">Share</text>
      </motion.g>

      {/* Layers */}
      <motion.g {...enter(0.15)}>
        <line x1="130" y1="36" x2="130" y2="480" stroke={LINE} />
        <text x="12" y="58" fontSize="9" fill={MUTE} letterSpacing="1">LAYERS</text>
        {LAYERS.map((name, n) => {
          const y = 70 + n * 22;
          const on = n === t.layer;
          const child = n > 0;
          return (
            <g key={name}>
              <motion.rect
                x="4"
                y={y}
                width="122"
                height="20"
                initial={false}
                animate={{ fill: on ? "rgba(244,60,0,0.18)" : "rgba(0,0,0,0)" }}
                transition={{ duration: 0.4 }}
              />
              {child ? (
                <rect x="22" y={y + 6} width="8" height="8" fill="none" stroke={on ? ACCENT : FAINT} strokeWidth="1.2" />
              ) : (
                <path d={`M12 ${y + 5} V${y + 15} M16 ${y + 5} V${y + 15} M9 ${y + 8} H19 M9 ${y + 12} H19`} stroke={MUTE} strokeWidth="1" />
              )}
              <text x={child ? 36 : 26} y={y + 13.5} fontSize="10" fill={on ? WHITE : child ? MUTE : WHITE}>
                {name}
              </text>
            </g>
          );
        })}
      </motion.g>

      {/* Properties */}
      <motion.g {...enter(0.25)}>
        <line x1="470" y1="36" x2="470" y2="480" stroke={LINE} />
        <text x="482" y="58" fontSize="9" fill={MUTE} letterSpacing="1">DESIGN</text>

        <AnimatePresence mode="wait" initial={false}>
          <motion.g
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <text x="482" y="80" fontSize="11" fontWeight="600" fill={WHITE}>{t.name}</text>

            <text x="482" y="104" fontSize="8" fill={MUTE}>W</text>
            <rect x="492" y="94" width="44" height="16" fill={RAISED} />
            <text x="498" y="105" fontSize="9" fill={WHITE}>{t.size[0]}</text>
            <text x="542" y="104" fontSize="8" fill={MUTE}>H</text>
            <rect x="550" y="94" width="40" height="16" fill={RAISED} />
            <text x="556" y="105" fontSize="9" fill={WHITE}>{t.size[1]}</text>

            <line x1="470" y1="124" x2="600" y2="124" stroke={LINE} />
            <text x="482" y="142" fontSize="9" fill={MUTE}>Fill</text>
            <rect x="482" y="150" width="14" height="14" fill={`#${t.fill}`} stroke={FAINT} />
            <text x="504" y="161" fontSize="9" fill={WHITE}>{t.fill}</text>
            <text x="590" y="161" textAnchor="end" fontSize="9" fill={MUTE}>100%</text>

            <line x1="470" y1="178" x2="600" y2="178" stroke={LINE} />
            <text x="482" y="196" fontSize="9" fill={MUTE}>Auto layout</text>
            <path d="M484 206 V218 M490 206 V218 M496 206 V218" stroke={ACCENT} strokeWidth="2" />
            <rect x="510" y="204" width="38" height="16" fill={RAISED} />
            <text x="516" y="215" fontSize="9" fill={WHITE}>{t.gap}</text>
            <text x="590" y="215" textAnchor="end" fontSize="8" fill={MUTE}>gap</text>
          </motion.g>
        </AnimatePresence>

        <line x1="470" y1="234" x2="600" y2="234" stroke={LINE} />
        <text x="482" y="252" fontSize="9" fill={MUTE}>Corner radius</text>
        <rect x="482" y="260" width="48" height="16" fill={RAISED} />
        <text x="488" y="271" fontSize="9" fill={WHITE}>0</text>

        <line x1="470" y1="290" x2="600" y2="290" stroke={LINE} />
        <text x="482" y="308" fontSize="9" fill={MUTE}>Colour styles</text>
        {[WHITE, "#9c9c9c", "#1f1f1f", ACCENT].map((c, n) => (
          <rect key={c} x={482 + n * 22} y="316" width="16" height="16" fill={c} stroke={FAINT} />
        ))}

        <line x1="470" y1="346" x2="600" y2="346" stroke={LINE} />
        <text x="482" y="364" fontSize="9" fill={MUTE}>Text</text>
        <text x="482" y="388" fontSize="20" fontWeight="600" fill={WHITE}>Aa</text>
        <text x="512" y="380" fontSize="8" fill={MUTE}>Host Grotesk</text>
        <text x="512" y="391" fontSize="8" fill={MUTE}>Medium · 32</text>
      </motion.g>

      {/* The design on the canvas */}
      <motion.g {...enter(0.35)}>
        <text x={F.x} y={F.y - 8} fontSize="9" fill={MUTE}>Dashboard — Desktop</text>
        <rect x={F.x} y={F.y} width={F.w} height={F.h} fill={SURFACE} />
        {/* sidebar */}
        <rect x={F.x} y={F.y} width="40" height={F.h} fill="#0f0f0f" />
        <rect x={F.x + 12} y={F.y + 12} width="16" height="16" fill={ACCENT} />
        {[44, 62, 80, 98].map((dy) => (
          <rect key={dy} x={F.x + 13} y={F.y + dy} width="14" height="3" fill={FAINT} />
        ))}
        {/* header */}
        <rect x={F.x + 50} y={F.y + 12} width="70" height="6" fill={WHITE} />
        <rect x={F.x + 50} y={F.y + 22} width="44" height="3" fill={FAINT} />
        <rect x={F.x + 256} y={F.y + 12} width="34" height="12" fill={ACCENT} />
        {/* KPI cards */}
        {[200, 284, 368].map((x, n) => (
          <g key={x}>
            <rect x={x} y="108" width="76" height="46" fill={RAISED} />
            <rect x={x + 8} y="116" width="26" height="3" fill={MUTE} />
            <rect x={x + 8} y="126" width={[40, 34, 46][n]} height="9" fill={WHITE} />
            <rect x={x + 8} y="142" width="18" height="4" fill={n === 1 ? ACCENT : FAINT} />
          </g>
        ))}
        {/* chart */}
        <rect x="200" y="162" width="244" height="86" fill={RAISED} />
        <rect x="208" y="170" width="50" height="4" fill={MUTE} />
        {[30, 44, 26, 52, 40, 60, 48, 66, 54].map((h, n) => (
          <rect key={n} x={212 + n * 25} y={240 - h} width="12" height={h} fill={n === 7 ? ACCENT : "#3d3d3d"} />
        ))}
        {/* table */}
        {[256, 276, 296].map((y, n) => (
          <g key={y}>
            <rect x="200" y={y} width="244" height="18" fill={n === 0 ? "#191919" : RAISED} />
            <circle cx="210" cy={y + 9} r="4" fill={n === 0 ? MUTE : FAINT} />
            <rect x="220" y={y + 7} width="60" height="4" fill={n === 0 ? MUTE : FAINT} />
            <rect x="330" y={y + 7} width="36" height="4" fill={FAINT} />
            <rect x="412" y={y + 5} width="24" height="8" fill={n === 1 ? ACCENT : FAINT} />
          </g>
        ))}
      </motion.g>

      {/* Selection */}
      <motion.g {...enter(0.6)}>
        <motion.rect
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.5"
          initial={false}
          animate={{ x: b.x, y: b.y, width: b.w, height: b.h }}
          transition={spring}
        />
        {handles.map(([hx, hy], n) => (
          <motion.rect
            key={n}
            width="6"
            height="6"
            fill={WHITE}
            stroke={ACCENT}
            strokeWidth="1.2"
            initial={false}
            animate={{ x: hx - 3, y: hy - 3 }}
            transition={spring}
          />
        ))}
        <motion.g initial={false} animate={{ x: b.x + b.w / 2 - 28, y: b.y + b.h + 6 }} transition={spring}>
          <rect width="56" height="14" fill={ACCENT} />
          <text x="28" y="10" textAnchor="middle" fontSize="8" fontWeight="600" fill={WHITE}>
            {t.size[0]} × {t.size[1]}
          </text>
        </motion.g>
      </motion.g>

      {/* Comment pin */}
      <motion.g
        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: ease.outExpo, delay: delay + 1.2 }}
        style={{ transformOrigin: "428px 70px" }}
      >
        <path d="M428 42 h22 v18 h-14 l-8 8 z" fill={WHITE} />
        <text x="439" y="55" textAnchor="middle" fontSize="9" fontWeight="600" fill="#000">D</text>
      </motion.g>

      {/* Collaborator cursor */}
      <motion.g initial={false} animate={{ x: dev.x, y: dev.y }} transition={{ duration: 1.6, ease: ease.inOutQuart }}>
        <path d="M0 0 L0 14 L4 10 L7 16 L9.5 15 L6.5 9 L11 9 Z" fill="#9c9c9c" stroke="#000" strokeWidth="0.8" />
        <rect x="10" y="14" width="26" height="13" fill="#9c9c9c" />
        <text x="23" y="23.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">Dev</text>
      </motion.g>

      {/* My cursor, riding the selection's corner */}
      <motion.g
        initial={false}
        animate={{ x: b.x + b.w - 8, y: b.y + b.h - 8 }}
        transition={{ duration: 1, ease: ease.outExpo }}
      >
        <path d="M0 0 L0 16 L4.5 11.5 L8 18 L10.5 17 L7.5 10.5 L13 10.5 Z" fill={WHITE} stroke="#000" strokeWidth="0.8" />
        {/* Near the canvas edge the name tag flips left so it never crosses into the panel. */}
        <motion.g initial={false} animate={{ x: flip ? -50 : 12 }} transition={{ duration: 0.5, ease: ease.outExpo }}>
          <rect y="16" width="44" height="14" fill={ACCENT} />
          <text x="22" y="26" textAnchor="middle" fontSize="8" fontWeight="600" fill={WHITE}>Radhev</text>
        </motion.g>
      </motion.g>
    </svg>
  );
}
