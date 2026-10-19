"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

type Layer = {
  k: string;
  img: string;
  d: string;
  /** Which side the card travels up, and how far below the fold it starts, in vh. */
  lane: "left" | "right";
  start: number;
};

/**
 * The four layers, dealt alternately into the two lanes and spaced so that
 * one card is crossing the stage at any point in the scroll.
 */
const layers: Layer[] = [
  { k: "Tokens", img: "/system/tokens.webp", d: "Colour, type, spacing and radius — the smallest decisions, made once.", lane: "left", start: 80 },
  { k: "Components", img: "/system/components.webp", d: "Buttons, inputs, toggles and cards with every state accounted for.", lane: "right", start: 135 },
  { k: "Patterns", img: "/system/patterns.webp", d: "Forms, navigation and lists that solve recurring problems.", lane: "left", start: 190 },
  { k: "Products", img: "/system/products.webp", d: "Screens and flows composed from the system, consistent by default.", lane: "right", start: 245 },
];

/** How far, in vh, each card climbs across the pinned scroll. */
const TRAVEL = 230;

/**
 * A pinned stage with the statement held in the middle while the four
 * layers climb past it on either side.
 *
 * The warm fade is the section's own background rather than a scroll-driven
 * colour: the band is 320vh tall and the stage is sticky, so the gradient
 * slides behind the held text on its own, and the same declaration reads
 * correctly top-to-bottom on a phone where nothing is pinned.
 *
 * Below md, and whenever reduced motion is asked for, the lanes are dropped
 * and the layers are listed under the statement instead.
 */
export function DesignSystem() {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const drifting = !reduced;

  return (
    <section
      ref={ref}
      aria-label="Design beyond the screen"
      className={`relative overflow-clip bg-[linear-gradient(180deg,#c23200_0%,#8d2705_26%,#431304_60%,#0a0a0a_100%)] ${drifting ? "lg:h-[320vh]" : ""}`}
    >
      {/* The dot grid the whole section is built on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:radial-gradient(rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:14px_14px]"
      />

      <div className={`relative flex min-h-[100svh] flex-col justify-center ${drifting ? "lg:sticky lg:top-0 lg:h-[100svh]" : ""}`}>
        {/* The statement, held in the middle of the stage. */}
        <div className="relative z-10 gutter mx-auto flex w-full max-w-[1600px] flex-col items-center text-center section-y lg:py-0">
          <span className="label !text-bone/70">(02)&nbsp;&nbsp;Systems thinking</span>

          <h2 className="section-title mt-8 max-w-[13ch] text-balance md:mt-10">
            Design Beyond the Screen
          </h2>

          <p className="section-intro mt-6 max-w-[44ch] !text-bone/80 md:mt-8">
            Interfaces are systems before they are screens. A shared set of decisions keeps products coherent as they grow.
          </p>

          <ScrollDot progress={scrollYProgress} active={drifting} />
        </div>

        {/* After the statement, so a screen reader meets the heading before
            the layers it introduces. Absolute either way, so the stage looks
            the same; `z-0` against the statement's `z-10` keeps the text on top. */}
        {drifting &&
          layers.map((l, i) => (
            <DriftCard key={l.k} layer={l} index={i} progress={scrollYProgress} />
          ))}

        {/* Phones, and anyone who asked for less motion, read the layers as a list. */}
        <ol className={`relative z-10 gutter mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 pb-24 sm:grid-cols-2 ${drifting ? "lg:hidden" : "md:grid-cols-4 md:pb-32"}`}>
          {layers.map((l, i) => (
            <li key={l.k}>
              <LayerCard layer={l} index={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** One layer climbing its lane, from below the fold to above it. */
function DriftCard({ layer, index, progress }: { layer: Layer; index: number; progress: MotionValue<number> }) {
  const y = useTransform(progress, [0, 1], [`${layer.start}vh`, `${layer.start - TRAVEL}vh`]);

  return (
    <motion.div
      style={{ y }}
      className={`absolute top-0 z-0 hidden w-[clamp(15rem,20vw,20rem)] lg:block ${
        layer.lane === "left" ? "left-[var(--gutter)]" : "right-[var(--gutter)]"
      }`}
    >
      <LayerCard layer={layer} index={index} />
    </motion.div>
  );
}

/**
 * A layer as a card: the screen it produces, a strip of the grid, what it
 * holds, and its place in the stack.
 */
function LayerCard({ layer, index }: { layer: Layer; index: number }) {
  return (
    <article className="border border-line bg-ink/70 p-3 backdrop-blur-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink-3">
        <Image
          src={layer.img}
          alt=""
          fill
          sizes="(min-width: 768px) 22vw, 90vw"
          unoptimized
          className="object-cover"
        />
      </div>

      <DotStrip seed={index} />

      <h3 className="label mt-3 !text-bone">{layer.k}</h3>
      <p className="mt-2 text-small leading-relaxed text-bone/60">{layer.d}</p>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="label">Design system</span>
        <span className="label !text-accent">0{index + 1}</span>
      </div>
    </article>
  );
}

/**
 * The grid itself, as a readout. Which cells are lit is derived from the
 * layer's index rather than drawn at random, so the server and the client
 * agree and the four cards stay visibly different from one another.
 */
function DotStrip({ seed }: { seed: number }) {
  return (
    <div
      aria-hidden
      className="mt-3 grid gap-[3px] [grid-template-columns:repeat(24,1fr)]"
    >
      {Array.from({ length: 48 }, (_, i) => {
        const lit = (i * 7 + seed * 11) % 17 < 2;
        return <span key={i} className={`aspect-square ${lit ? "bg-accent" : "bg-bone/15"}`} />;
      })}
    </div>
  );
}

/** Progress through the stage, as the reference's record dot. */
function ScrollDot({ progress, active }: { progress: MotionValue<number>; active: boolean }) {
  const scale = useTransform(progress, [0, 1], [0.35, 1]);

  return (
    <div className="mt-12 hidden h-10 w-10 items-center justify-center rounded-full border border-accent lg:mt-16 lg:flex">
      <motion.span
        aria-hidden
        className="block h-3 w-3 rounded-full bg-accent"
        style={active ? { scale } : undefined}
      />
      <span className="sr-only">Scroll to step through the system</span>
    </div>
  );
}
