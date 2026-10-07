"use client";

import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { about, site } from "@/lib/content";

/**
 * A single statement, as on the reference: this sits second on the page, so
 * its job is to say who in one breath and hand over to the work.
 *
 * The exploded layer illustration, the secondary paragraph and the
 * disciplines list have all gone — disciplines are the Capabilities
 * section's job, and the rest made this the longest block on a page whose
 * subject is the work. LayerStack is still in the repo if it earns a place
 * somewhere else.
 */
export function About() {
  return (
    <section id="about" aria-label="About" className="surface-invert relative gutter mx-auto max-w-[1600px] py-24 md:py-32">
      <SectionHeader index="02" label="About" />

      <div className="mt-8 grid grid-cols-1 gap-8 md:mt-10 md:grid-cols-12">
        <h2 className="md:col-span-9">
          <TextReveal
            as="span"
            text={about.intro}
            className="block text-title font-medium leading-[1.15] tracking-[-0.03em]"
          />
        </h2>

        <Reveal delay={0.2} className="md:col-span-3 md:pt-2">
          <p className="label">{site.location}</p>
          <p className="label mt-2">{site.role}</p>
          {site.available && (
            <p className="label mt-2 flex items-center gap-2 !text-bone">
              <span aria-hidden className="size-1 bg-accent" />
              {site.availabilityLabel}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
