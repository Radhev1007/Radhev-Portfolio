"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { clients, testimonials } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { Portrait } from "./Portrait";

const SWIPE_THRESHOLD = 48;

/**
 * Client voices as a single editorial moment: oversized heading, one portrait,
 * one quote, and a quiet logo strip underneath.
 *
 * The carousel is a labelled region rather than a widget: arrow keys move it
 * when focus is inside, the live region announces each change, and the
 * portrait and quote move together so the slide reads as one object. Motion
 * is direction-aware — going back moves things the other way — and collapses
 * to a plain cross-fade when the visitor has asked for reduced motion.
 */
export function Testimonials() {
  const reduced = usePrefersReducedMotion();
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0]);
  const touchX = useRef<number | null>(null);
  const total = testimonials.length;
  const person = testimonials[index];

  const go = useCallback(
    (step: number) => setSlide(([i]) => [(i + step + total) % total, step]),
    [total],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  // Pause nothing, autoplay nothing: the visitor drives it.
  useEffect(() => () => void (touchX.current = null), []);

  const shift = reduced ? 0 : 1;

  return (
    <section
      id="testimonials"
      aria-label="Client voices"
      className="relative gutter mx-auto max-w-[1600px] py-24 md:py-32"
    >
      <SectionHeader index="07" label="Client voices" />

      <div className="mt-10 grid grid-cols-1 items-end gap-10 md:mt-16 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-7">
          <h2 className="text-headline font-medium leading-[0.86] tracking-[-0.05em]">
            What
            <br />
            <span className="text-bone/55">they say</span>
          </h2>
        </Reveal>
        <p className="label md:col-span-4 md:col-start-9 md:pb-3">
          Trusted by clients · proven through real work
        </p>
      </div>

      {/* Carousel */}
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Client testimonials"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
        className="mt-16 grid grid-cols-1 items-center gap-10 focus-visible:outline-offset-8 md:mt-24 md:grid-cols-12 md:gap-8"
      >
        {/* Portrait */}
        <div className="md:col-span-4">
          <div className="relative mx-auto w-full max-w-[320px] rotate-[-2deg] md:mx-0 md:max-w-none">
            <div className="relative aspect-3/4 overflow-hidden bg-ink-2">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={index}
                  className="absolute inset-0"
                  custom={direction}
                  initial={{ opacity: 0, scale: reduced ? 1 : 1.04, x: direction * 24 * shift }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: reduced ? 1 : 0.98, x: -direction * 24 * shift }}
                  transition={{ duration: 0.6, ease: ease.outExpo }}
                >
                  <Portrait person={person} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="md:col-span-7 md:col-start-6">
          <div aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.blockquote
                key={index}
                custom={direction}
                initial={{ opacity: 0, x: direction * 32 * shift }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 32 * shift }}
                transition={{ duration: 0.6, ease: ease.outExpo }}
              >
                <p className="max-w-[46ch] text-title font-medium leading-[1.3] tracking-[-0.025em] text-bone/85">
                  &ldquo;{person.quote}&rdquo;
                </p>
                <footer className="mt-10">
                  <p className="text-lead tracking-tight">{person.name}</p>
                  <p className="label mt-2">
                    {person.role} · {person.company}
                  </p>
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="mt-12 flex items-center gap-6">
            <div className="flex gap-2">
              <Arrow label="Previous testimonial" onClick={() => go(-1)} direction="prev" />
              <Arrow label="Next testimonial" onClick={() => go(1)} direction="next" />
            </div>
            <p className="label tabular-nums">
              {String(index + 1).padStart(2, "0")} — {String(total).padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      {/* Clients */}
      <div className="mt-24 md:mt-32">
        <p className="label">Clients I&apos;ve worked with</p>
        <ul className="no-scrollbar mt-6 flex gap-10 overflow-x-auto md:flex-wrap md:gap-16 md:overflow-visible">
          {clients.map((c, i) => (
            <li key={c} className="shrink-0">
              <Reveal delay={i * 0.06}>
                <span className="whitespace-nowrap text-lead tracking-tight text-bone/35 transition-colors duration-500 hover:text-bone/80">
                  {c}
                </span>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Arrow({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: "prev" | "next";
}) {
  const prev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-cursor="cta"
      className="group grid size-12 place-items-center border border-line transition-colors duration-300 hover:border-bone/45 hover:bg-bone/5"
    >
      <span
        aria-hidden
        className={`block transition-transform duration-500 ease-[var(--ease-out-expo)] ${
          prev ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"
        }`}
      >
        {prev ? "←" : "→"}
      </span>
    </button>
  );
}
