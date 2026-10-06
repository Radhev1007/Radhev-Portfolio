"use client";

import { Reveal } from "@/components/Animations/Reveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { experience } from "@/lib/content";

/**
 * Employment history as a ruled list rather than a decorated timeline: the
 * dates sit in their own column so the eye can run down them, and each role
 * is separated by the same hairline used elsewhere.
 */
export function Experience() {
  return (
    <section
      id="experience"
      aria-label="Experience"
      className="relative gutter mx-auto max-w-[1600px] py-24 md:py-40"
    >
      <SectionHeader index="06" label="Experience" count={experience.length} countNoun="Roles" />

      <Reveal>
        <h2 className="mt-8 max-w-[18ch] text-title font-medium leading-[0.95] tracking-[-0.045em] md:mt-10">
          Where I&apos;ve <span className="font-accent text-bone/80">worked</span>
        </h2>
      </Reveal>

      <ol className="mt-16 md:mt-24">
        {experience.map((role, i) => (
          <li key={`${role.company}-${role.from}`} className="border-t border-line">
            <Reveal delay={i * 0.08}>
              <article className="grid grid-cols-1 gap-8 py-10 md:grid-cols-12 md:gap-8 md:py-16">
                {/* Dates and place */}
                <div className="md:col-span-4">
                  <p className="label flex items-center gap-2 !text-bone">
                    {role.to === "Present" && <span aria-hidden className="size-1 bg-accent" />}
                    <span>
                      {role.from} — {role.to}
                    </span>
                  </p>
                  <p className="label mt-2">{role.location}</p>
                </div>

                {/* Role */}
                <div className="md:col-span-8">
                  <h3 className="text-subtitle font-medium leading-[1.05] tracking-[-0.035em]">
                    {role.company}
                  </h3>
                  <p className="label mt-2">{role.title}</p>

                  <ul className="mt-8 flex flex-col gap-4">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-4 text-small leading-relaxed text-mute">
                        <span aria-hidden className="mt-2 size-1 shrink-0 bg-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
