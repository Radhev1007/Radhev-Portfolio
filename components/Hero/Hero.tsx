"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/Animations/Button";
import { HeroIllustration } from "@/components/Illustrations/HeroIllustration";
import { useScrollTo } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { intro, transition } from "@/lib/motion";
import { HeroIdentity } from "./HeroIdentity";
import { ScrollCue } from "./ScrollCue";
import { SocialLinks } from "./SocialLinks";

/**
 * A quiet, editorial opening: sharp type on the left, a flat illustration
 * of the craft on the right, and plenty of room around both.
 */
export function Hero() {
  const reduced = usePrefersReducedMotion();
  const scrollTo = useScrollTo();

  const appear = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: transition(delay, 1.1),
  });

  return (
    <section id="home" aria-label="Introduction" className="relative flex min-h-[100svh] flex-col bg-ink">
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 items-center gap-16 gutter pb-28 pt-32 md:grid-cols-12 md:gap-8 md:pb-24 md:pt-36">
        <div className="md:col-span-6">
          <motion.ul className="label flex flex-wrap items-center gap-x-3 gap-y-1 !text-bone/70" aria-label="Disciplines" {...appear(intro.label)}>
            {site.disciplines.map((d, i) => (
              <li key={d} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="size-1 rounded-full bg-accent" />}
                {d}
              </li>
            ))}
          </motion.ul>

          <HeroIdentity first={site.heroTitle.first} last={site.heroTitle.last} delay={intro.title} />

          <motion.p className="mt-8 max-w-[34ch] text-base leading-relaxed text-mute md:mt-10 md:text-lg" {...appear(intro.supporting)}>
            {site.statement}
          </motion.p>

          <motion.div className="mt-10 flex flex-wrap items-center gap-3" {...appear(intro.cta)}>
            <Button onClick={() => scrollTo("work")} cursor="view" cursorLabel="View">
              View My Work
            </Button>
            <Button variant="ghost" onClick={() => scrollTo("contact")} cursor="view" cursorLabel="Open">
              Let&apos;s Connect
            </Button>
          </motion.div>
        </div>

        <div className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
          <HeroIllustration delay={intro.objects} />
        </div>
      </div>

      <SocialLinks />
      <ScrollCue />
    </section>
  );
}
