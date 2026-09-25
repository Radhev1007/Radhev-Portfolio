"use client";

import { Button } from "@/components/Animations/Button";
import { Magnetic } from "@/components/Animations/Magnetic";
import { Parallax } from "@/components/Animations/Parallax";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { ContactIllustration } from "@/components/Illustrations/ContactIllustration";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { site } from "@/lib/content";

export function Contact() {
  const links = [{ label: "Email", href: `mailto:${site.email}`, value: site.email }, ...site.socials.map((s) => ({ ...s, value: s.label }))];

  return (
    <section id="contact" aria-label="Contact" className="relative flex min-h-[100svh] flex-col py-28 md:py-32">

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col justify-between gap-16 gutter mx-auto w-full max-w-[1600px]">
        <SectionHeader index="07" label="Contact" />

        <div className="flex flex-col items-center text-center">
          <Parallax speed={70} className="mb-10 w-40 md:mb-12 md:w-52">
            <ContactIllustration />
          </Parallax>
          <TextReveal
            as="h2"
            text="Let's Create Something Meaningful."
            className="max-w-[14ch] text-[clamp(2.75rem,8.5vw,9.5rem)] font-medium leading-[0.88] tracking-[-0.055em]"
          />
          <Reveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-bone/80 md:text-lg">
              Have a product, platform, or digital experience in mind? Let&apos;s build something thoughtful together.
            </p>
          </Reveal>
          <Reveal delay={0.3} className="pointer-events-auto mt-10">
            <Button href={`mailto:${site.email}`}>Start a Conversation</Button>
          </Reveal>
        </div>

        <ul className="pointer-events-auto grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {links.map((l) => (
            <li key={l.label} className="bg-ink">
              <Magnetic strength={0.12} className="block">
                <a
                  href={l.href}
                  {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex h-full flex-col gap-6 p-5 transition-colors duration-500 hover:bg-bone hover:text-ink md:p-6"
                >
                  <span className="label transition-colors group-hover:text-ink/60">{l.label}</span>
                  <span className="flex items-end justify-between gap-2 text-sm md:text-base">
                    <span className="truncate">{l.value}</span>
                    <span aria-hidden className="transition-transform duration-500 group-hover:-translate-y-1 group-hover:translate-x-1">
                      ↗
                    </span>
                  </span>
                </a>
              </Magnetic>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
