"use client";

import { motion, type MotionValue } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Project, VisualKind } from "@/lib/content";

/**
 * Cover visual for a project. When `project.image` is set it renders that
 * image; otherwise it draws an interface composition in SVG. Both layers use
 * `xMidYMid slice`, so the artwork behaves like `object-fit: cover` and stays
 * aligned at any size — which is what makes the shared-element transition
 * into the case study seamless.
 */
type Props = {
  project: Project;
  /** Parallax offset for the foreground device layer. */
  fgX?: MotionValue<number>;
  fgY?: MotionValue<number>;
  priority?: boolean;
  sizes?: string;
};

export function ProjectVisual({ project, fgX, fgY, priority, sizes = "(min-width: 1024px) 60vw, 100vw" }: Props) {
  const { from, to } = project.palette;

  if (project.image) {
    return (
      <div className="absolute inset-0">
        <Image
          src={project.image}
          alt={project.imageAlt ?? `${project.title} cover`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden" role="img" aria-label={`${project.title} — interface preview`}>
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        <rect width="1600" height="1000" fill={from} />
        {/* Flat geometric field */}
        <circle cx="1380" cy="140" r="360" fill={to} opacity="0.22" />
        <rect x="0" y="780" width="520" height="220" fill={to} opacity="0.12" />
        {Array.from({ length: 17 }, (_, i) => (
          <line key={i} x1={i * 100} y1="0" x2={i * 100} y2="1000" stroke="#fff" strokeOpacity="0.05" />
        ))}
      </svg>
      <motion.svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        style={{ x: fgX, y: fgY }}
      >
        <g style={{ fontFamily: "var(--font-sans)" }}>{scenes[project.visual](project)}</g>
      </motion.svg>
    </div>
  );
}

/* ── Primitives ─────────────────────────────────────────────── */

const INK = "#0f0f13";
const PANEL = "#17171d";
const T = "#ece8e1";
const MUTE = "rgba(236,232,225,0.4)";
const FAINT = "rgba(236,232,225,0.12)";

const Bar = ({ x, y, w, h = 12, c = FAINT }: { x: number; y: number; w: number; h?: number; c?: string }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={c} />
);

function Browser({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      
      <rect width={w} height={h} rx="20" fill={INK} />
      <rect width={w} height="52" rx="20" fill={PANEL} />
      <rect y="32" width={w} height="20" fill={PANEL} />
      {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
        <circle key={c} cx={30 + i * 22} cy="26" r="6.5" fill={c} opacity="0.8" />
      ))}
      <rect x={w / 2 - 160} y="14" width="320" height="24" rx="12" fill="#22222a" />
      <g transform="translate(0 52)">{children}</g>
    </g>
  );
}

function Phone({ x, y, s = 1, children }: { x: number; y: number; s?: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      
      <rect width="300" height="620" rx="46" fill="#050507" />
      <rect x="10" y="10" width="280" height="600" rx="38" fill={INK} />
      <rect x="110" y="22" width="80" height="22" rx="11" fill="#000" />
      <g transform="translate(10 10)">{children}</g>
    </g>
  );
}

/* ── Scenes ─────────────────────────────────────────────────── */

const scenes: Record<VisualKind, (p: Project) => ReactNode> = {
  dashboard: (p) => (
    <Browser x={230} y={150} w={1140} h={700}>
      <rect width="220" height="648" fill="#121217" />
      <rect x="24" y="28" width="34" height="34" rx="10" fill={p.palette.to} />
      <Bar x={68} y={40} w={90} />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i} transform={`translate(0 ${100 + i * 46})`}>
          {i === 2 && <rect x="14" y="-14" width="192" height="38" rx="10" fill={p.palette.to} opacity="0.18" />}
          <rect x="28" y="-2" width="14" height="14" rx="4" fill={i === 2 ? p.palette.to : FAINT} />
          <Bar x={54} y={0} w={70 + ((i * 29) % 60)} h={10} c={i === 2 ? T : FAINT} />
        </g>
      ))}
      <text x="260" y="72" fill={T} fontSize="30" fontWeight="600">Service requests</text>
      <Bar x={260} y={90} w={220} h={10} />
      <rect x="930" y="40" width="170" height="44" rx="22" fill={T} />
      <Bar x={965} y={57} w={100} h={10} c="rgba(15,15,19,0.55)" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${260 + i * 284} 130)`}>
          <rect width="268" height="120" rx="16" fill={PANEL} />
          <Bar x={22} y={26} w={100} h={10} c={MUTE} />
          <text x="22" y="92" fill={T} fontSize="40" fontWeight="600">{["1,284", "92%", "4.1d"][i]}</text>
          <rect x="190" y="74" width="56" height="24" rx="12" fill={p.palette.to} opacity="0.35" />
        </g>
      ))}
      <g transform="translate(260 272)">
        <rect width="836" height="352" rx="16" fill={PANEL} />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(24 ${34 + i * 52})`}>
            {i > 0 && <line x1="0" y1="-18" x2="788" y2="-18" stroke={FAINT} />}
            <circle cx="14" cy="6" r="14" fill={FAINT} />
            <Bar x={44} y={0} w={180 - i * 12} h={11} c={i === 0 ? MUTE : "rgba(236,232,225,0.6)"} />
            <Bar x={330} y={0} w={120} h={11} />
            <Bar x={520} y={0} w={90} h={11} />
            <rect x="690" y="-6" width="96" height="26" rx="13" fill={[p.palette.to, "#6fe3b5", "#febc2e"][i % 3]} opacity={i === 0 ? 0 : 0.3} />
          </g>
        ))}
      </g>
    </Browser>
  ),

  analytics: (p) => (
    <g>
      <Browser x={170} y={170} w={1000} h={660}>
        <text x="40" y="72" fill={T} fontSize="30" fontWeight="600">Weekly health</text>
        <Bar x={40} y={90} w={200} h={10} />
        <g transform="translate(40 130)">
          <rect width="440" height="230" rx="18" fill={PANEL} />
          <circle cx="120" cy="115" r="72" fill="none" stroke={FAINT} strokeWidth="22" />
          <circle cx="120" cy="115" r="72" fill="none" stroke={p.palette.to} strokeWidth="22" strokeDasharray="330 452" strokeLinecap="round" transform="rotate(-90 120 115)" />
          <text x="86" y="128" fill={T} fontSize="36" fontWeight="600">73%</text>
          <Bar x={240} y={70} w={150} h={12} c="rgba(236,232,225,0.6)" />
          <Bar x={240} y={100} w={110} h={10} />
          <Bar x={240} y={150} w={160} h={12} c="rgba(236,232,225,0.6)" />
          <Bar x={240} y={180} w={90} h={10} />
        </g>
        <g transform="translate(500 130)">
          <rect width="460" height="230" rx="18" fill={PANEL} />
          <path d="M24 170 C 80 170, 90 80, 150 110 S 240 40, 290 90 S 380 150, 436 60" fill="none" stroke={p.palette.to} strokeWidth="4" />
          <path d="M24 170 C 80 170, 90 80, 150 110 S 240 40, 290 90 S 380 150, 436 60 L 436 206 L 24 206 Z" fill={p.palette.to} opacity="0.12" />
          <circle cx="290" cy="90" r="8" fill={T} />
        </g>
        <g transform="translate(40 380)">
          <rect width="920" height="220" rx="18" fill={PANEL} />
          {Array.from({ length: 14 }, (_, i) => {
            const h = 40 + ((i * 37) % 110);
            return <rect key={i} x={30 + i * 63} y={190 - h} width="34" height={h} rx="8" fill={i === 9 ? p.palette.to : FAINT} />;
          })}
        </g>
      </Browser>
      <Phone x={1110} y={250} s={0.95}>
        <text x="28" y="100" fill={MUTE} fontSize="18">Today</text>
        <text x="28" y="146" fill={T} fontSize="40" fontWeight="600">8,432</text>
        <Bar x={28} y={164} w={120} h={10} />
        <circle cx="140" cy="300" r="80" fill="none" stroke={FAINT} strokeWidth="18" />
        <circle cx="140" cy="300" r="80" fill="none" stroke={p.palette.to} strokeWidth="18" strokeDasharray="380 503" strokeLinecap="round" transform="rotate(-90 140 300)" />
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(20 ${420 + i * 72})`}>
            <rect width="240" height="60" rx="16" fill={PANEL} />
            <rect x="12" y="12" width="36" height="36" rx="10" fill={p.palette.to} opacity="0.35" />
            <Bar x={60} y={20} w={110} h={9} c="rgba(236,232,225,0.6)" />
            <Bar x={60} y={36} w={70} h={8} />
          </g>
        ))}
      </Phone>
    </g>
  ),

  web: (p) => (
    <Browser x={200} y={140} w={1200} h={720}>
      <Bar x={50} y={34} w={80} h={14} c={T} />
      {[0, 1, 2, 3].map((i) => (
        <Bar key={i} x={720 + i * 100} y={36} w={70} h={10} />
      ))}
      <text x="48" y="260" fill={T} fontSize="170" fontWeight="700" letterSpacing="-8">PLAY.</text>
      <text x="48" y="420" fill="none" stroke={T} strokeOpacity="0.6" strokeWidth="2" fontSize="170" fontWeight="700" letterSpacing="-8">LEARN.</text>
      <Bar x={52} y={470} w={360} h={12} c="rgba(236,232,225,0.5)" />
      <Bar x={52} y={496} w={280} h={12} />
      <rect x="52" y="546" width="190" height="56" rx="28" fill={p.palette.to} />
      <Bar x={92} y={568} w={110} h={11} c={INK} />
      <g transform="translate(700 110)">
        <rect width="440" height="300" rx="20" fill={p.palette.to} />
        <circle cx="330" cy="120" r="90" fill="#fff" opacity="0.18" />
        <path d="M0 240 Q 160 150 440 230 L 440 300 L 0 300 Z" fill={INK} opacity="0.25" />
        <rect x="24" y="24" width="96" height="30" rx="15" fill={INK} opacity="0.5" />
      </g>
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${700 + i * 228} 430)`}>
          <rect width="212" height="190" rx="18" fill={PANEL} />
          <rect x="18" y="18" width="176" height="90" rx="12" fill={i ? "#2a2a33" : p.palette.from} />
          <Bar x={18} y={128} w={130} h={11} c="rgba(236,232,225,0.6)" />
          <Bar x={18} y={152} w={90} h={9} />
        </g>
      ))}
    </Browser>
  ),

  tablet: (p) => (
    <g transform="translate(180 130)">
      
      <rect width="1240" height="760" rx="56" fill="#060608" />
      <rect x="22" y="22" width="1196" height="716" rx="38" fill={INK} />
      <g transform="translate(22 22)">
        <rect width="780" height="716" rx="38" fill="#121216" />
        <g transform="translate(90 90)" stroke={p.palette.to} strokeWidth="3" fill="none" opacity="0.9">
          <rect width="600" height="520" />
          <line x1="260" y1="0" x2="260" y2="300" />
          <line x1="0" y1="300" x2="420" y2="300" />
          <line x1="420" y1="180" x2="420" y2="520" />
          <line x1="420" y1="180" x2="600" y2="180" />
          <path d="M260 220 A 60 60 0 0 1 320 280" />
          <path d="M140 300 A 50 50 0 0 0 190 350" />
        </g>
        <rect x="120" y="120" width="200" height="140" fill={p.palette.to} opacity="0.14" />
        <text x="130" y="200" fill={T} fontSize="22" fontWeight="600">Living</text>
        <text x="540" y="290" fill={MUTE} fontSize="20">Bed 01</text>
        <text x="130" y="520" fill={MUTE} fontSize="20">Kitchen</text>
        <circle cx="610" cy="120" r="24" fill={T} />
        <path d="M600 120 h20 M610 110 v20" stroke={INK} strokeWidth="3" />
        <g transform="translate(804 0)">
          <text x="10" y="80" fill={MUTE} fontSize="20">Residence</text>
          <text x="10" y="140" fill={T} fontSize="52" fontWeight="600">Unit 12B</text>
          {["Bedrooms", "Area", "Floor", "View"].map((k, i) => (
            <g key={k} transform={`translate(10 ${200 + i * 70})`}>
              <line x1="0" y1="-26" x2="360" y2="-26" stroke={FAINT} />
              <text x="0" y="12" fill={MUTE} fontSize="20">{k}</text>
              <Bar x={220} y={2} w={120 - i * 14} h={12} c="rgba(236,232,225,0.6)" />
            </g>
          ))}
          <rect x="10" y="540" width="360" height="64" rx="32" fill={p.palette.to} />
          <Bar x={120} y={566} w={140} h={12} c={INK} />
          <rect x="10" y="622" width="360" height="64" rx="32" fill="none" stroke={FAINT} strokeWidth="2" />
        </g>
      </g>
    </g>
  ),

  system: (p) => (
    <g>
      <g transform="translate(160 150)">
        <rect width="560" height="420" rx="24" fill={INK} />
        <text x="40" y="200" fill={T} fontSize="200" fontWeight="600" letterSpacing="-6">Aa</text>
        {[64, 40, 24, 16].map((s, i) => (
          <g key={s} transform={`translate(360 ${80 + i * 80})`}>
            <Bar x={0} y={0} w={150 - i * 24} h={Math.max(8, s / 3)} c={i === 0 ? T : MUTE} />
            <text x="0" y="46" fill={MUTE} fontSize="16">{`${s} / ${Math.round(s * 1.3)}`}</text>
          </g>
        ))}
        <Bar x={40} y={290} w={260} h={12} c="rgba(236,232,225,0.6)" />
        <Bar x={40} y={318} w={200} h={12} />
        <Bar x={40} y={346} w={230} h={12} />
      </g>
      <g transform="translate(760 150)">
        <rect width="680" height="200" rx="24" fill={INK} />
        {[p.palette.to, p.palette.from, "#ece8e1", "#6fe3b5", "#5ce1ff", "#8d8a83"].map((c, i) => (
          <g key={i} transform={`translate(${36 + i * 104} 36)`}>
            <rect width="88" height="88" rx="18" fill={c} stroke={FAINT} />
            <Bar x={0} y={110} w={60} h={9} c={MUTE} />
            <Bar x={0} y={128} w={44} h={8} />
          </g>
        ))}
      </g>
      <g transform="translate(760 380)">
        <rect width="680" height="190" rx="24" fill={INK} />
        <rect x="36" y="40" width="190" height="56" rx="28" fill={p.palette.to} />
        <Bar x={80} y={62} w={100} h={11} c={INK} />
        <rect x="246" y="40" width="190" height="56" rx="28" fill="none" stroke={MUTE} strokeWidth="2" />
        <Bar x={290} y={62} w={100} h={11} c={T} />
        <rect x="456" y="44" width="92" height="48" rx="24" fill={p.palette.to} />
        <circle cx="524" cy="68" r="18" fill="#fff" />
        <rect x="36" y="116" width="400" height="48" rx="12" fill={PANEL} stroke={FAINT} />
        <Bar x={56} y={135} w={160} h={10} c={MUTE} />
        <rect x="570" y="44" width="48" height="48" rx="12" fill={PANEL} stroke={FAINT} />
        <path d="M582 68 l10 10 l16 -20" stroke={p.palette.to} strokeWidth="4" fill="none" />
      </g>
      <g transform="translate(160 600)">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${i * 434} 0)`}>
            <rect width="410" height="250" rx="24" fill={INK} />
            <rect x="20" y="20" width="370" height="120" rx="14" fill={i === 1 ? p.palette.to : "#22222a"} opacity={i === 1 ? 0.8 : 1} />
            <Bar x={20} y={164} w={220} h={14} c={T} />
            <Bar x={20} y={192} w={300} h={10} />
            <Bar x={20} y={212} w={250} h={10} />
          </g>
        ))}
      </g>
    </g>
  ),
};
