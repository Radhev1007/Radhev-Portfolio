"use client";

import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { specialisms } from "@/lib/content";

/**
 * What I specialise in.
 *
 * Five rows, not a grid of icon cards. A capability list with twelve chips
 * and a logo for each says "I have heard of these things"; five lines with
 * room around them say which five matter, and the editorial setting is the
 * argument — a designer claiming hierarchy should demonstrate it here.
 */
export function Specialisms() {
  return (
    <section
      id="specialisms"
      aria-label="What I specialise in"
      className="surface-invert relative gutter mx-auto max-w-[1600px] py-24 md:py-32"
    >
      <SectionHeader index="03" label="What I specialise in" countNoun="areas" />

      <ul className="mt-14 md:mt-20">
        {specialisms.map((s, i) => (
          <li key={s.id}>
            <Reveal delay={i * 0.05}>
              <div className="grid grid-cols-12 items-baseline gap-x-6 gap-y-3 border-t border-line py-7 md:gap-x-8 md:py-9">
                <p className="label col-span-12 md:col-span-1">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="col-span-12 text-subtitle font-medium leading-[1.1] tracking-[-0.03em] md:col-span-4">
                  {s.title}
                </h3>
                <p className="col-span-12 max-w-[52ch] text-body leading-relaxed text-mute md:col-span-6 md:col-start-6">
                  {s.blurb}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      <div className="border-t border-line" />
    </section>
  );
}
