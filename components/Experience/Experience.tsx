"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { experience } from "@/lib/content";
import { ease, viewportOnce } from "@/lib/motion";

/**
 * Employment history as a set of full-bleed rows.
 *
 * The meta column is sticky, so a company, its dates and its index stay
 * pinned while that role's responsibilities scroll past — the reading order
 * stays anchored without a decorative rail. Hovering a row lifts it onto the
 * raised surface and fills its index with the accent, which is the same
 * inversion the contact channels use.
 */
export function Experience() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="experience" aria-label="Experience" className="relative py-24 md:py-40">
      <div className="gutter mx-auto max-w-[1600px]">
        <SectionHeader index="07" label="Experience" count={experience.length} countNoun="Roles" />

        <div className="mt-8 flex flex-col justify-between gap-6 md:mt-10 md:flex-row md:items-end">
          <Reveal>
            <h2 className="max-w-[18ch] text-title font-medium leading-[0.95] tracking-[-0.045em]">
              Where I&apos;ve <span className="font-accent text-bone/80">worked</span>
            </h2>
          </Reveal>
          <p className="label max-w-xs md:text-right">
            {experience[0].from} — present · {experience.length} roles
          </p>
        </div>
      </div>

      <ol className="mt-16 md:mt-24">
        {experience.map((role, i) => {
          const current = role.to === "Present";
          return (
            <li
              key={`${role.company}-${role.from}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="relative"
            >
              {/* Raised surface on hover, drawn from the row's own top edge. */}
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 origin-top bg-ink-2"
                initial={false}
                animate={{ scaleY: active === i ? 1 : 0, opacity: active === i ? 1 : 0 }}
                transition={{ duration: 0.5, ease: ease.outExpo }}
              />

              <div className="gutter relative mx-auto grid max-w-[1600px] grid-cols-1 gap-8 py-10 md:grid-cols-12 md:gap-8 md:py-16">
                {/* Pinned meta */}
                <div className="md:col-span-4 md:sticky md:top-24 md:self-start">
                  <motion.p
                    className="text-display font-medium leading-[0.8] tracking-[-0.05em]"
                    aria-hidden
                    initial={false}
                    animate={{ color: active === i ? "var(--color-accent)" : "var(--color-faint)" }}
                    transition={{ duration: 0.5, ease: ease.outExpo }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </motion.p>

                  <p className="label mt-6 flex items-center gap-2 !text-bone">
                    {current && (
                      <motion.span
                        aria-hidden
                        className="size-1 bg-accent"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    {role.from} — {role.to}
                  </p>
                  <p className="label mt-2">{role.location}</p>
                </div>

                {/* Role */}
                <div className="md:col-span-8">
                  <h3 className="text-subtitle font-medium leading-[1.05] tracking-[-0.035em]">{role.company}</h3>
                  <p className="label mt-2">{role.title}</p>

                  <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
                    {role.points.map((point, p) => (
                      <motion.li
                        key={point}
                        className="flex gap-4 text-small leading-relaxed text-mute"
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={viewportOnce}
                        transition={{ duration: 0.7, delay: p * 0.06, ease: ease.outExpo }}
                      >
                        <span aria-hidden className="mt-2 size-1 shrink-0 bg-accent" />
                        <span>{point}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
