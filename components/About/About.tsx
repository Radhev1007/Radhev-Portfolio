"use client";

import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { about, site } from "@/lib/content";

/**
 * About.
 *
 * It opens with a line nobody else would write, then says what that actually
 * means, then where it has been. The sectors are listed rather than
 * described: once the paragraph has made the point, a reader scanning for
 * "government" or "fintech" wants to find the word, not a sentence about it.
 */
export function About() {
  return (
    <section
      id="about"
      aria-label="About"
      className="relative gutter mx-auto max-w-[1600px] py-24 md:py-32"
    >
      <SectionHeader index="04" label="About" countNoun="years" />

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 md:mt-16 md:grid-cols-12">
        <h2 className="md:col-span-7">
          <TextReveal
            as="span"
            text={about.headline}
            className="block text-headline font-medium leading-[0.92] tracking-[-0.045em]"
          />
        </h2>

        <div className="md:col-span-5 md:col-start-8 md:pt-2">
          <Reveal delay={0.15}>
            <p className="max-w-[48ch] text-lead leading-[1.45] tracking-[-0.01em]">
              {about.intro}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-6 max-w-[52ch] text-body leading-relaxed text-mute">{about.body}</p>
          </Reveal>

          <Reveal delay={0.35}>
            <ul className="mt-10 flex flex-wrap gap-x-2 gap-y-2" aria-label="Sectors">
              {about.sectors.map((sector, i) => (
                <li key={sector} className="label flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="size-1 bg-accent" />}
                  {sector}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.45}>
            <p className="label mt-10">
              {site.location} · {site.role}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
