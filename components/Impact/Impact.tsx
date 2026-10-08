"use client";

import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { impact } from "@/lib/content";

/**
 * Designing for complexity.
 *
 * Qualitative on purpose. The only number here is the one that can be checked
 * against the roles further down the page — inventing conversion lifts and
 * satisfaction scores for products under NDA is how a portfolio stops being
 * believable, and anyone senior enough to hire for this work knows it.
 */
export function Impact() {
  return (
    <section
      id="impact"
      aria-label="Designing for complexity"
      className="relative gutter mx-auto max-w-[1600px] py-24 md:py-32"
    >
      <SectionHeader index="04" label="Designing for complexity" countNoun="notes" />

      <dl className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:mt-20 md:grid-cols-4">
        {impact.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.06}>
            <div>
              <dt className="text-title font-medium leading-[0.95] tracking-[-0.04em]">
                {item.figure}
              </dt>
              <dd className="mt-4 max-w-[26ch] text-small leading-relaxed text-mute">
                {item.label}
              </dd>
            </div>
          </Reveal>
        ))}
      </dl>
    </section>
  );
}
