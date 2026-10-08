"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { clients, testimonials } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { Portrait } from "./Portrait";

const SWIPE_THRESHOLD = 48;

/**
 * Client voices.
 *
 * The headline is split so the portrait sits in the gap between the two
 * halves and breaks the rule beneath them — the picture interrupts the
 * typography rather than sitting politely beside it, which is the whole
 * composition. On a phone there is no gap to sit in, so it stacks.
 *
 * The carousel is a labelled region rather than a widget: arrow keys move it
 * when focus is inside, the live region announces each change, and the
 * portrait and quote move together so a slide reads as one object. Motion is
 * direction-aware and collapses to a cross-fade under reduced motion.
 */
export function Testimonials() {
  const reduced = usePrefersReducedMotion();
  const [[index, direction], setSlide] = useState<[number, number]>([0, 0]);
  const touchX = useRef<number | null>(null);
  const total = testimonials.length;
  const person = testimonials[index];
  const shift = reduced ? 0 : 1;

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

  return (
    <section
      id="testimonials"
      aria-label="Client voices"
      className="relative gutter mx-auto max-w-[1600px] py-24 md:py-32"
    >
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
        className="relative flex flex-col focus-visible:outline-offset-8 md:block"
      >
        {/* ── Headline, split around the portrait ─────────────── */}
        <Reveal className="order-1">
          <h2 className="grid grid-cols-12 items-end text-display font-medium uppercase leading-[0.86] tracking-[-0.045em]">
            <span className="col-span-12 md:col-span-4">What</span>
            <span className="col-span-12 md:col-span-7 md:col-start-6">They say</span>
          </h2>
        </Reveal>

        <div className="order-2 mt-6 h-px w-full bg-line md:mt-8" />

        {/* ── Label, quote, controls ──────────────────────────── */}
        <div className="order-4 mt-8 grid grid-cols-12 gap-x-8 gap-y-10 md:mt-10">
          <p className="label col-span-12 md:col-span-3">(07) Client voices</p>

          <div className="col-span-12 md:col-span-6 md:col-start-6">
            <div aria-live="polite" aria-atomic="true">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.blockquote
                  key={index}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 28 * shift }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -direction * 28 * shift }}
                  transition={{ duration: 0.55, ease: ease.outExpo }}
                >
                  <p className="max-w-[62ch] font-mono text-small uppercase leading-[1.75] tracking-[0.055em] text-bone/75">
                    &ldquo;{person.quote}&rdquo;
                  </p>
                  <footer className="mt-8">
                    <p className="text-body tracking-tight text-bone/90">
                      {person.name} · {person.role}, {person.company}
                    </p>
                  </footer>
                </motion.blockquote>
              </AnimatePresence>
            </div>

            <p className="label mt-8 tabular-nums md:hidden">
              {String(index + 1).padStart(2, "0")} — {String(total).padStart(2, "0")}
            </p>
          </div>

          {/* On wide screens the controls sit out at the right edge, clear of
              the quote, the way the reference stacks them. */}
          <div className="col-span-12 flex items-center gap-3 md:col-span-1 md:col-start-12 md:-mt-20 md:flex-col md:items-end">
            <Arrow label="Previous testimonial" onClick={() => go(-1)} direction="prev" />
            <Arrow label="Next testimonial" onClick={() => go(1)} direction="next" />
            <p className="label ml-2 hidden tabular-nums md:ml-0 md:mt-2 md:block">
              {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
            </p>
          </div>
        </div>

        {/* ── Portrait ────────────────────────────────────────
            Absolute on wide screens so it can overlap the headline and the
            rule; a plain block underneath the headline on a phone. */}
        <div
          className="order-3 mt-10 w-full max-w-[280px] rotate-[-2.2deg] md:absolute md:left-[21%] md:top-[-1.5%] md:z-10 md:mt-0 md:w-[17.5%] md:max-w-none"
        >
          <div className="relative aspect-4/5 overflow-hidden bg-ink-2">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={index}
                className="absolute inset-0"
                custom={direction}
                initial={{ opacity: 0, scale: reduced ? 1 : 1.05, x: direction * 20 * shift }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.98, x: -direction * 20 * shift }}
                transition={{ duration: 0.55, ease: ease.outExpo }}
              >
                <Portrait person={person} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Clients ───────────────────────────────────────────── */}
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
      className="group grid size-12 shrink-0 place-items-center border border-line transition-colors duration-300 hover:border-bone/45 hover:bg-bone/5"
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
