"use client";

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { useScrollRange } from "@/lib/motion";
import { processSteps } from "@/lib/content";
import { useDeviceTier, usePrefersReducedMotion } from "@/lib/hooks";
import { ProcessGlyph } from "./ProcessGlyph";

export function Process() {
  const tier = useDeviceTier();
  return tier === "desktop" ? <HorizontalProcess /> : <StackedProcess />;
}

function Intro() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeader index="04" label="Process" />
      <TextReveal as="h2" text="How I Design" className="text-[length:var(--text-headline)] font-medium leading-[0.9] tracking-[-0.05em]" />
      <Reveal delay={0.15}>
        <p className="max-w-sm text-[17px] leading-relaxed text-bone/80">
          A flexible, evidence-led process — six stages that move from understanding to a refined, shippable product.
        </p>
      </Reveal>
    </div>
  );
}

/** Desktop: the section pins and vertical scroll drives a horizontal track. */
function HorizontalProcess() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const reduced = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const measure = () => track.current && setDistance(track.current.scrollWidth - window.innerWidth);
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  const x = useTransform(reduced ? scrollYProgress : smooth, [0, 1], [0, -distance]);
  const bar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    let best = 0;
    processSteps.forEach((_, i) => {
      if (Math.abs(p - stageCenter(i)) < Math.abs(p - stageCenter(best))) best = i;
    });
    setActive(best);
  });

  return (
    <section id="process" ref={section} aria-label="How I design" className="relative" style={{ height: `calc(100svh + ${distance}px)` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <motion.div ref={track} className="flex w-max items-stretch gap-6 pl-[var(--gutter)] pr-[12vw]" style={{ x }}>
          <div className="flex w-[34vw] shrink-0 flex-col justify-center pr-12">
            <Intro />
          </div>
          {processSteps.map((s, i) => (
            <StepPanel key={s.n} step={s} index={i} progress={scrollYProgress} active={i === active} />
          ))}
        </motion.div>

        <div className="absolute inset-x-[var(--gutter)] bottom-10 flex items-center gap-6">
          <span className="label !text-bone/80">Discover</span>
          <div className="h-0.5 flex-1 rounded-full bg-bone/15">
            <motion.div className="h-0.5 rounded-full bg-accent" style={{ width: bar }} />
          </div>
          <span className="label !text-bone/80">Refine</span>
        </div>
      </div>
    </section>
  );
}

type Step = (typeof processSteps)[number];

/** Scroll position at which each stage sits at the centre of the track. */
const stageCenter = (index: number) => (index + 0.6) / (processSteps.length + 0.4);

/**
 * Every card stays fully legible. The active stage is inverted — off-white
 * surface, black type — so focus reads through colour, not by dimming others.
 */
function StepPanel({ step, index, progress, active }: { step: Step; index: number; progress: MotionValue<number>; active: boolean }) {
  const center = stageCenter(index);
  // Offsets must stay inside 0…1 and non-decreasing for scroll-linked animations.
  const range = [Math.max(0, center - 0.22), center, Math.min(1, center + 0.22)];
  const lift = useScrollRange(progress, range, [24, 0, -24]);

  return (
    <article
      aria-current={active ? "step" : undefined}
      className={`relative flex h-[68vh] w-[min(38vw,560px)] shrink-0 flex-col justify-between overflow-hidden rounded-[28px] border p-10 transition-colors duration-500 ${
        active ? "border-bone bg-bone text-ink" : "border-bone/15 bg-ink-3 text-bone"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`label transition-colors duration-500 ${active ? "!text-ink/70" : "!text-bone/75"}`}>Stage {step.n}</span>
        <motion.div style={{ y: lift }}>
          <ProcessGlyph index={index} tone={active ? "light" : "dark"} />
        </motion.div>
      </div>
      <div>
        <span
          aria-hidden
          className={`block text-[9rem] font-light leading-[0.8] tracking-[-0.04em] transition-colors duration-500 ${active ? "text-ink" : "text-accent"}`}
        >
          {step.n}
        </span>
        <h3 className="mt-6 text-5xl font-medium tracking-[-0.04em]">{step.title}</h3>
        <p className={`mt-4 max-w-xs text-[17px] leading-relaxed transition-colors duration-500 ${active ? "text-ink/75" : "text-bone/80"}`}>
          {step.body}
        </p>
      </div>
    </article>
  );
}

/** Tablet & mobile: a vertical path that draws itself as you scroll. */
function StackedProcess() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="process" aria-label="How I design" className="relative gutter py-28">
      <Intro />
      <ol ref={ref} className="relative mt-16 flex flex-col gap-14 pl-10">
        <span aria-hidden className="absolute bottom-0 left-[7px] top-0 w-px bg-bone/20" />
        <motion.span aria-hidden className="absolute bottom-0 left-[7px] top-0 w-px origin-top bg-accent" style={{ scaleY }} />
        {processSteps.map((s, i) => (
          <li key={s.n} className="relative">
            <span aria-hidden className="absolute -left-10 top-2 size-[15px] rounded-full border-2 border-accent bg-ink" />
            <Reveal>
              <div className="flex items-center justify-between">
                <span className="label !text-accent">Stage {s.n}</span>
                <ProcessGlyph index={i} small />
              </div>
              <h3 className="mt-3 text-4xl font-medium tracking-[-0.04em]">{s.title}</h3>
              <p className="mt-3 max-w-md text-base leading-relaxed text-bone/80">{s.body}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
