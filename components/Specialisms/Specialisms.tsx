"use client";

import type { ReactNode } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { specialisms } from "@/lib/content";

/**
 * What I specialise in.
 *
 * A bento of five cards. Product design leads at double width because it is
 * the work the rest serves; the other four sit beneath it as equals. Each
 * card carries a small line drawing of the thing itself — a dashboard, a
 * component set, a flow, a type specimen, a handoff — drawn in the page's
 * own ink so it reads as part of the system rather than as clip art.
 * Hovering inverts the card, the same move the contact channels make.
 */
export function Specialisms() {
  return (
    <section
      id="specialisms"
      aria-label="What I specialise in"
      className="surface-invert relative gutter mx-auto max-w-[1600px] section-y"
    >
      <SectionHeader index="03" label="Specialisms" count={specialisms.length} countNoun="Areas" />

      <div className="mt-8 grid grid-cols-1 gap-6 md:mt-12 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-7">
          <h2 className="section-title max-w-[14ch]">
            What I <span className="font-accent text-bone/60">specialise in</span>
          </h2>
        </Reveal>
        <Reveal className="md:col-span-4 md:col-start-9 md:self-end" delay={0.15}>
          <p className="section-intro">
            Five areas where I do my best work, from the first user flow to the component a developer ships.
          </p>
        </Reveal>
      </div>

      <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        {specialisms.map((s, i) => (
          <li
            key={s.id}
            className={i === 0 ? "sm:col-span-2" : i === specialisms.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}
          >
            <Reveal delay={i * 0.06} className="h-full">
              <div className="group flex h-full min-h-[260px] flex-col justify-between gap-10 rounded-card bg-ink-2 p-6 transition-colors duration-500 hover:bg-bone md:min-h-[300px] md:p-8">
                <div className="flex items-start justify-between gap-6">
                  <span className="label tabular-nums transition-colors duration-500 group-hover:!text-ink/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="w-28 text-bone/80 transition-colors duration-500 group-hover:text-ink md:w-32">
                    {GLYPHS[s.id]}
                  </span>
                </div>

                <div>
                  <h3 className="text-item font-normal leading-[1.1] tracking-[-0.03em] transition-colors duration-500 group-hover:text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-[40ch] text-body leading-relaxed text-mute transition-colors duration-500 group-hover:text-ink/70">
                    {s.blurb}
                  </p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Glyphs ─────────────────────────────────────────────────────
   Line drawings on a shared 120×72 box. Strokes take the card's text
   colour; the one accent element in each is what moves on hover. */

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 120 72" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-auto w-full overflow-visible" aria-hidden>
    {children}
  </svg>
);

const move = "transition-transform duration-700 ease-[var(--ease-out-expo)]";

const GLYPHS: Record<string, ReactNode> = {
  // A dashboard: window, sidebar, and a bar chart that grows on hover.
  product: svg(
    <>
      <rect x="1" y="1" width="118" height="70" rx="3" />
      <line x1="1" y1="11" x2="119" y2="11" />
      <line x1="28" y1="11" x2="28" y2="71" />
      <line x1="8" y1="20" x2="21" y2="20" />
      <line x1="8" y1="27" x2="18" y2="27" />
      <line x1="8" y1="34" x2="21" y2="34" />
      {[40, 54, 68, 82, 96].map((x, i) => {
        const top = 30 + ((i * 11) % 22);
        return (
          <rect
            key={x}
            x={x}
            y={top}
            width="8"
            height={62 - top}
            className={`origin-bottom [transform-box:fill-box] ${move} group-hover:scale-y-125 ${i === 3 ? "fill-accent stroke-accent" : ""}`}
          />
        );
      })}
    </>,
  ),
  // A component set: six variants, one selected.
  systems: svg(
    <>
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => (
          <rect
            key={`${c}${r}`}
            x={4 + c * 40}
            y={6 + r * 34}
            width="32"
            height="26"
            rx={r === 0 ? 13 : 3}
            className={c === 1 && r === 0 ? `fill-accent stroke-accent ${move} group-hover:-translate-y-1` : ""}
          />
        )),
      )}
      <rect x="40" y="2" width="40" height="34" rx="2" strokeDasharray="2 2" className="stroke-accent" />
    </>,
  ),
  // A flow: a step, a decision, an outcome — ending on the accent.
  strategy: svg(
    <>
      <rect x="2" y="26" width="24" height="20" rx="2" />
      <path d="M26 36 H46" />
      <path d="M58 24 L70 36 L58 48 L46 36 Z" />
      <path d="M70 36 H92" />
      <path d="M58 48 V64 H104 V48" strokeDasharray="2 2" />
      <circle cx="104" cy="36" r="12" className={`fill-accent stroke-accent ${move} group-hover:translate-x-1`} />
    </>,
  ),
  // A type specimen: a glyph pair between a cap line and a baseline.
  visual: svg(
    <>
      <line x1="0" y1="56" x2="120" y2="56" strokeDasharray="2 2" />
      <line x1="0" y1="18" x2="120" y2="18" strokeDasharray="2 2" />
      <text x="2" y="56" stroke="none" fill="currentColor" fontSize="50" fontWeight="500" letterSpacing="-2">
        Aa
      </text>
      <circle
        cx="100"
        cy="37"
        r="13"
        className={`fill-accent stroke-accent origin-center [transform-box:fill-box] ${move} group-hover:scale-110`}
      />
    </>,
  ),
  // Handoff: a frame becoming code.
  handoff: svg(
    <>
      <rect x="1" y="12" width="44" height="48" rx="3" />
      <rect x="9" y="22" width="28" height="10" rx="5" className="fill-accent stroke-accent" />
      <line x1="9" y1="42" x2="37" y2="42" />
      <line x1="9" y1="50" x2="28" y2="50" />
      <path d="M52 36 H66 M61 31 L66 36 L61 41" className={`${move} group-hover:translate-x-1.5`} />
      <path d="M84 24 L74 36 L84 48" />
      <path d="M108 24 L118 36 L108 48" />
      <line x1="100" y1="22" x2="92" y2="50" className="stroke-accent" />
    </>,
  ),
};
