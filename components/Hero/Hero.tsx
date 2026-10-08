"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/Animations/Button";
import { useScrollTo } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { intro, transition } from "@/lib/motion";
import { HeroIdentity } from "./HeroIdentity";
import { HeroPortrait } from "./HeroPortrait";
import { HeroVideo } from "./HeroVideo";
import { ScrollCue } from "./ScrollCue";
import { SocialLinks } from "./SocialLinks";

/**
 * Two columns rather than two stacked rows: the left carries the whole
 * written argument — disciplines, display line, statement, actions — and
 * the right is given over to the portrait alone, so it can take the
 * height of the viewport instead of only the band above the headline.
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
    <section id="home" aria-label="Introduction" className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <HeroVideo />
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 items-center gap-6 gutter pb-8 pt-24 md:grid-cols-12 md:gap-10 md:pb-10 md:pt-24">
        {/* The portrait leads on narrow screens, right-hand column on wide
            ones. It sits behind the written column's stacking context, so the
            links and buttons there still take their own clicks. */}
        <div className="order-1 h-[31svh] w-full md:order-2 md:col-span-5 md:col-start-8 md:h-[62svh]">
          <HeroPortrait />
        </div>

        <div className="relative z-10 order-2 md:order-1 md:col-span-6">
          <div>
            <HeroIdentity
              lines={[site.heroTitle.lead, site.heroTitle.mid, site.heroTitle.tail]}
              delay={intro.title}
            />
          </div>

          <motion.p
            className="mt-4 max-w-[52ch] font-mono text-caption uppercase leading-[1.7] tracking-[0.1em] text-mute md:mt-6"
            {...appear(intro.supporting)}
          >
            {site.statement}
          </motion.p>

          <motion.div className="mt-4 flex flex-wrap items-center gap-2 md:mt-6" {...appear(intro.cta)}>
            <Button
              onClick={() => scrollTo(site.heroCtas.primary.target)}
              cursor="view"
              cursorLabel="View"
            >
              {site.heroCtas.primary.label}
            </Button>
            <Button
              variant="ghost"
              onClick={() => scrollTo(site.heroCtas.secondary.target)}
              cursor="view"
              cursorLabel="Read"
            >
              {site.heroCtas.secondary.label}
            </Button>
          </motion.div>

          <SocialLinks />
        </div>
      </div>

      <ScrollCue />
    </section>
  );
}
