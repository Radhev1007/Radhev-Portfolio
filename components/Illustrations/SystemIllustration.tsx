"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { ill } from "./palette";

const T = ({ x, y, children, anchor = "start" as const }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} fill={ill.grey} fontSize="11" letterSpacing="1.5" textAnchor={anchor}>
    {children}
  </text>
);

/** Tokens → Components → Patterns → Products, drawn as flat artwork on a shared frame. */
const panels: ReactNode[] = [
  // 0 — Tokens
  <g key="tokens">
    <T x={40} y={70}>COLOUR</T>
    {[ill.paper, ill.grey, ill.surface3, ill.cyan].map((c, i) => (
      <g key={c}>
        <rect x={40 + i * 122} y="86" width="106" height="106" rx="10" fill={c} stroke={ill.line} />
        <text x={40 + i * 122} y="214" fill={ill.paper} fontSize="12">{["paper", "grey", "surface", "accent"][i]}</text>
      </g>
    ))}
    <T x={40} y={272}>TYPE</T>
    <text x="36" y="372" fill={ill.paper} fontSize="104" fontWeight="500" letterSpacing="-4">Aa</text>
    {[40, 28, 18, 13].map((s, i) => (
      <g key={s}>
        <rect x="220" y={300 + i * 22} width={240 - i * 46} height={Math.max(6, s / 3)} rx="3" fill={i ? ill.faint : ill.paper} />
        <text x="520" y={308 + i * 22} fill={ill.grey} fontSize="11" textAnchor="end">{s}</text>
      </g>
    ))}
    <T x={40} y={430}>SPACING</T>
    {[4, 8, 12, 16, 24, 32, 48].map((s, i) => (
      <rect key={s} x={40 + i * 66} y={512 - s * 1.4} width="44" height={s * 1.4} fill={i === 4 ? ill.cyan : ill.surface3} />
    ))}
  </g>,

  // 1 — Components
  <g key="components">
    <T x={40} y={70}>BUTTONS</T>
    <rect x="40" y="86" width="170" height="52" rx="26" fill={ill.paper} />
    <rect x="80" y="109" width="90" height="7" rx="3.5" fill={ill.ink} />
    <rect x="226" y="86" width="170" height="52" rx="26" fill="none" stroke={ill.faint} strokeWidth="1.5" />
    <rect x="266" y="109" width="90" height="7" rx="3.5" fill={ill.paper} />
    <rect x="412" y="86" width="108" height="52" rx="26" fill={ill.surface3} />
    <rect x="440" y="109" width="52" height="7" rx="3.5" fill={ill.grey} />
    <T x={40} y={196}>CONTROLS</T>
    <rect x="40" y="212" width="84" height="44" rx="22" fill={ill.cyan} />
    <circle cx="102" cy="234" r="16" fill={ill.ink} />
    <rect x="144" y="212" width="84" height="44" rx="22" fill={ill.surface3} />
    <circle cx="166" cy="234" r="16" fill={ill.grey} />
    <rect x="252" y="214" width="40" height="40" rx="8" fill={ill.paper} />
    <path d="M 262 234 l 7 7 l 14 -15" stroke={ill.ink} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="308" y="214" width="40" height="40" rx="8" fill="none" stroke={ill.faint} strokeWidth="1.5" />
    <circle cx="390" cy="234" r="20" fill="none" stroke={ill.paper} strokeWidth="1.5" />
    <circle cx="390" cy="234" r="9" fill={ill.paper} />
    <circle cx="444" cy="234" r="20" fill="none" stroke={ill.faint} strokeWidth="1.5" />
    <T x={40} y={320}>INPUT</T>
    <rect x="40" y="336" width="480" height="56" rx="10" fill={ill.surface2} stroke={ill.cyan} strokeWidth="1.5" />
    <rect x="62" y="360" width="160" height="8" rx="4" fill={ill.paper} />
    <rect x="226" y="354" width="2" height="20" fill={ill.cyan} />
    <T x={40} y={420}>CARD</T>
    <rect x="40" y="436" width="230" height="96" rx="12" fill={ill.surface2} />
    <rect x="58" y="454" width="60" height="60" rx="10" fill={ill.surface3} />
    <rect x="132" y="462" width="110" height="8" rx="4" fill={ill.paper} />
    <rect x="132" y="480" width="80" height="6" rx="3" fill={ill.faint} />
    <rect x="290" y="436" width="230" height="96" rx="12" fill={ill.paper} />
    <rect x="308" y="454" width="60" height="60" rx="10" fill={ill.cyan} />
    <rect x="382" y="462" width="110" height="8" rx="4" fill={ill.ink} />
    <rect x="382" y="480" width="80" height="6" rx="3" fill={ill.grey} />
  </g>,

  // 2 — Patterns
  <g key="patterns">
    <T x={40} y={70}>NAVIGATION</T>
    <rect x="40" y="86" width="480" height="52" rx="26" fill={ill.surface2} />
    <circle cx="68" cy="112" r="12" fill={ill.paper} />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={150 + i * 72} y="108" width="50" height="7" rx="3.5" fill={i === 1 ? ill.paper : ill.faint} />
    ))}
    <rect x="440" y="98" width="68" height="28" rx="14" fill={ill.cyan} />
    <T x={40} y={196}>FORM</T>
    <rect x="40" y="212" width="230" height="318" rx="14" fill={ill.surface2} />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect x="60" y={236 + i * 70} width="70" height="6" rx="3" fill={ill.grey} />
        <rect x="60" y={250 + i * 70} width="190" height="36" rx="8" fill={ill.surface3} stroke={i === 1 ? ill.cyan : "none"} strokeWidth="1.5" />
      </g>
    ))}
    <rect x="60" y="460" width="190" height="44" rx="22" fill={ill.paper} />
    <T x={290} y={196}>LIST</T>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <rect x="290" y={212 + i * 64} width="230" height="52" rx="10" fill={i === 2 ? ill.paper : ill.surface2} />
        <circle cx="316" cy={238 + i * 64} r="12" fill={i === 2 ? ill.cyan : ill.surface3} />
        <rect x="340" y={230 + i * 64} width={120 - i * 8} height="7" rx="3.5" fill={i === 2 ? ill.ink : ill.paper} />
        <rect x="340" y={243 + i * 64} width="70" height="5" rx="2.5" fill={i === 2 ? ill.grey : ill.faint} />
      </g>
    ))}
  </g>,

  // 3 — Products
  <g key="products">
    <T x={40} y={70}>WEB</T>
    <rect x="40" y="86" width="360" height="250" rx="12" fill={ill.surface2} />
    <rect x="40" y="86" width="360" height="30" rx="12" fill={ill.surface3} />
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={60 + i * 16} cy="101" r="4.5" fill={ill.grey} />
    ))}
    <rect x="62" y="140" width="150" height="16" rx="3" fill={ill.paper} />
    <rect x="62" y="164" width="110" height="16" rx="3" fill={ill.paper} />
    <rect x="62" y="196" width="130" height="6" rx="3" fill={ill.faint} />
    <rect x="62" y="226" width="96" height="32" rx="16" fill={ill.cyan} />
    <circle cx="316" cy="200" r="62" fill={ill.paper} />
    <rect x="252" y="236" width="128" height="80" rx="10" fill={ill.surface3} />
    <T x={430} y={70}>MOBILE</T>
    <rect x="430" y="86" width="136" height="276" rx="26" fill={ill.surface2} stroke={ill.line} />
    <rect x="474" y="96" width="48" height="10" rx="5" fill={ill.ink} />
    <circle cx="498" cy="176" r="40" fill="none" stroke={ill.surface3} strokeWidth="10" />
    <circle cx="498" cy="176" r="40" fill="none" stroke={ill.cyan} strokeWidth="10" strokeDasharray="170 252" strokeLinecap="round" transform="rotate(-90 498 176)" />
    {[0, 1].map((i) => (
      <rect key={i} x="446" y={240 + i * 46} width="104" height="36" rx="10" fill={ill.surface3} />
    ))}
    <T x={40} y={392}>DASHBOARD</T>
    <rect x="40" y="408" width="526" height="126" rx="12" fill={ill.surface2} />
    {Array.from({ length: 12 }, (_, i) => {
      const h = 18 + ((i * 29) % 70);
      return <rect key={i} x={64 + i * 30} y={514 - h} width="16" height={h} rx="3" fill={i === 8 ? ill.cyan : ill.surface3} />;
    })}
    <rect x="440" y="430" width="104" height="10" rx="5" fill={ill.paper} />
    <text x="440" y="490" fill={ill.paper} fontSize="36" fontWeight="500">86%</text>
  </g>,
];

export function SystemIllustration({ step }: { step: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <svg viewBox="0 0 606 580" className="h-auto w-full" role="img" aria-label={`Design system illustration: ${["tokens", "components", "patterns", "products"][step]}`}>
      <rect x="0.5" y="0.5" width="605" height="579" rx="18" fill={ill.surface} stroke={ill.line} />
      <text x="40" y="36" fill={ill.grey} fontSize="11" letterSpacing="1.5">{`0${step + 1} / 04`}</text>
      <AnimatePresence mode="wait">
        <motion.g
          key={step}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={{ duration: 0.55, ease: ease.outExpo }}
        >
          {panels[step]}
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}
