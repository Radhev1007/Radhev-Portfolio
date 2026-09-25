"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Parallax } from "@/components/Animations/Parallax";
import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { skills } from "@/lib/content";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

/** Hand-placed constellation: x/y in %, depth 0 (far) … 1 (near). */
const placements = [
  { x: 14, y: 22, d: 0.9 },
  { x: 58, y: 12, d: 0.6 },
  { x: 80, y: 34, d: 1 },
  { x: 30, y: 46, d: 0.5 },
  { x: 70, y: 62, d: 0.85 },
  { x: 8, y: 70, d: 0.7 },
  { x: 44, y: 78, d: 1 },
  { x: 86, y: 84, d: 0.55 },
  { x: 24, y: 94, d: 0.8 },
  { x: 40, y: 26, d: 0.4 },
];

/**
 * Skills as a spatial cluster rather than a list or a bar chart. Tags sit at
 * different depths, drift gently, and are pushed aside by the pointer; the
 * focused skill is described in a readout at the centre.
 */
export function Skills() {
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const [focus, setFocus] = useState<number | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!fine || reduced) return;
    const el = field.current;
    if (!el) return;
    const ptr = { x: -9999, y: -9999 };
    const offsets = placements.map(() => ({ x: 0, y: 0 }));
    let frame = 0;
    let running = false;

    const tick = (t: number) => {
      const rect = el.getBoundingClientRect();
      tagRefs.current.forEach((tag, i) => {
        if (!tag) return;
        const p = placements[i];
        const cx = rect.left + (p.x / 100) * rect.width;
        const cy = rect.top + (p.y / 100) * rect.height;
        const dx = cx - ptr.x;
        const dy = cy - ptr.y;
        const dist = Math.hypot(dx, dy) || 1;
        const push = Math.max(0, 1 - dist / 260) * 70 * p.d;
        const idleX = Math.sin(t / 1600 + i * 1.7) * 8 * p.d;
        const idleY = Math.cos(t / 1900 + i * 1.3) * 6 * p.d;
        const o = offsets[i];
        o.x += ((dx / dist) * push + idleX - o.x) * 0.08;
        o.y += ((dy / dist) * push + idleY - o.y) * 0.08;
        tag.style.transform = `translate3d(calc(-50% + ${o.x.toFixed(2)}px), calc(-50% + ${o.y.toFixed(2)}px), 0)`;
      });
      if (running) frame = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      ptr.x = e.clientX;
      ptr.y = e.clientY;
    };
    const vis = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      cancelAnimationFrame(frame);
      if (running) frame = requestAnimationFrame(tick);
    });
    vis.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      vis.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [fine, reduced]);

  const current = focus !== null ? skills[focus] : null;

  return (
    <section aria-label="Skills" className="relative gutter mx-auto max-w-[1600px] py-28 md:py-40">
      <SectionHeader index="06" label="Capabilities" />
      <div className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <Parallax speed={45}>
        <Reveal>
          <h2 className="text-[clamp(2.25rem,5vw,5rem)] font-medium leading-[0.95] tracking-[-0.045em]">
            What I bring
            <br />
            <span className="font-accent text-bone/80">to a team</span>
          </h2>
        </Reveal>
        </Parallax>
        <p className="label max-w-xs md:text-right">{fine ? "Move through the field · hover a skill" : "Tap a skill to learn more"}</p>
      </div>

      {/* Desktop / tablet: spatial field */}
      <div ref={field} className="relative mt-12 hidden h-[78vh] max-h-[760px] min-h-[520px] md:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="size-[46vmin] rounded-full border border-line" />
          <div className="absolute size-[72vmin] rounded-full border border-line/50" />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(34ch,40%)] -translate-x-1/2 -translate-y-1/2 text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: ease.outExpo }}
              >
                <p className="font-accent text-4xl">{current.label}</p>
                <p className="mt-2 text-sm text-bone/60">{current.note}</p>
              </motion.div>
            ) : (
              <motion.p key="idle" className="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {skills.length} disciplines
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <ul>
          {skills.map((s, i) => {
            const p = placements[i];
            const size = 0.95 + p.d * 0.9;
            const dim = focus !== null && focus !== i;
            return (
              <li
                key={s.label}
                ref={(el) => void (tagRefs.current[i] = el)}
                className="absolute"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate3d(-50%,-50%,0)", zIndex: Math.round(p.d * 10) }}
              >
                <motion.button
                  type="button"
                  onPointerEnter={() => setFocus(i)}
                  onPointerLeave={() => setFocus(null)}
                  onFocus={() => setFocus(i)}
                  onBlur={() => setFocus(null)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: ease.outExpo, delay: i * 0.05 }}
                  className={`whitespace-nowrap rounded-full border px-5 py-2.5 tracking-[-0.02em] transition-[background-color,color,border-color,opacity] duration-500 ${
                    focus === i ? "border-bone bg-bone text-ink" : "border-line bg-ink text-bone"
                  }`}
                  style={{
                    fontSize: `${size}rem`,
                    opacity: dim ? 0.25 : 0.55 + p.d * 0.45,
                  }}
                  aria-describedby={`skill-${i}`}
                >
                  {s.label}
                  <span id={`skill-${i}`} className="sr-only">
                    {s.note}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mobile: a compact tappable cluster */}
      <div className="mt-10 md:hidden">
        <ul className="flex flex-wrap gap-2">
          {skills.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => setFocus(focus === i ? null : i)}
                aria-expanded={focus === i}
                className={`rounded-full border px-4 py-2.5 text-[15px] transition-colors duration-300 ${
                  focus === i ? "border-bone bg-bone text-ink" : "border-line text-bone"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <AnimatePresence>
          {current && (
            <motion.p
              key={current.label}
              className="mt-6 border-l border-accent pl-4 text-bone/70"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="font-accent text-2xl text-bone">{current.label}</span>
              <br />
              {current.note}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
