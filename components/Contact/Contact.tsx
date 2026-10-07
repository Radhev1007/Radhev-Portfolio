"use client";

import { Magnetic } from "@/components/Animations/Magnetic";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { site } from "@/lib/content";

/**
 * The close, built as an ask rather than a directory: a headline, then the
 * address itself set as the largest type on the page, then the places to
 * follow. The address is the call to action — a button would only send
 * people to the same mailto with an extra step.
 *
 * There is no inline form here on purpose: a form needs somewhere to submit
 * to, and a dead one that silently drops enquiries is worse than none.
 */
export function Contact() {
  return (
    <section
      id="contact"
      aria-label="Contact"
      className="surface-invert relative gutter mx-auto flex min-h-[100svh] max-w-[1600px] flex-col py-24 md:py-32"
    >
      <SectionHeader index="10" label="Contact" />

      <div className="flex flex-1 flex-col justify-center py-16">
        <h2 className="max-w-[16ch] text-headline font-medium leading-[0.92] tracking-[-0.045em]">
          <TextReveal as="span" text="Ready to build" className="block" />
          <TextReveal as="span" text="something good?" delay={0.1} className="block text-bone/55" />
        </h2>

        <Reveal delay={0.2} className="mt-16 md:mt-24">
          <p className="label">Write</p>
          <Magnetic strength={0.1}>
            <a
              href={`mailto:${site.email}`}
              data-cursor="cta"
              className="mt-4 inline-block break-all text-title font-medium leading-[1] tracking-[-0.04em] text-accent transition-opacity duration-500 hover:opacity-70"
            >
              {site.email}
            </a>
          </Magnetic>
        </Reveal>

        <Reveal delay={0.3} className="mt-16 md:mt-24">
          <p className="label">Follow</p>
          <ul className="mt-4 flex flex-wrap items-center gap-8">
            {site.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 text-lead tracking-tight transition-colors duration-300 hover:text-accent"
                >
                  {s.label}
                  <span
                    aria-hidden
                    className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1"
                  >
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
