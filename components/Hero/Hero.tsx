"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/Animations/Button";
import { HeroIllustration } from "@/components/Illustrations/HeroIllustration";
import { site } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { intro, transition } from "@/lib/motion";
import { HeroIdentity } from "./HeroIdentity";
import { ScrambleText } from "@/components/Animations/ScrambleText";
import { PixelField } from "./PixelField";
import { ScrollCue } from "./ScrollCue";
import { SocialLinks, SocialRail } from "./SocialLinks";
import { useScrollTo } from "@/components/Providers/SmoothScroll";

/**
 * Two columns rather than two stacked rows: the left carries the whole
 * written argument — disciplines, display line, statement, actions — and
 * the right is given over to an animated design-session illustration —
 * the work itself, shown rather than described.
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
      <PixelField />
      {/* <HeroVideo /> goes back here once public/video/ has the files (see its README): without them it only
          requested a missing poster and videos. */}
      <div className="relative mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 items-center gap-6 gutter pb-8 pt-24 md:grid-cols-12 md:gap-10 md:pb-10 md:pt-24">
        {/* The illustration leads on narrow screens, right-hand column on wide
            ones. It sits behind the written column's stacking context, so the
            links and buttons there still take their own clicks. */}
        <div data-pixel-avoid className="order-1 mx-auto w-full max-w-[300px] md:order-2 md:col-span-5 md:col-start-8 md:max-w-[520px] md:pr-14">
          <HeroIllustration delay={intro.objects} />
        </div>

        <div data-pixel-avoid className="relative z-10 order-2 md:order-1 md:col-span-6">
          <HeroIdentity
            lines={[site.heroTitle.lead, site.heroTitle.mid, site.heroTitle.tail]}
            accent={site.heroTitle.accent}
            delay={intro.title}
          />

          {/* The statement is the page's largest text block on phones, so it is painted at once (only its
              slide-up waits for the intro): a fade from transparent held it back ~2.5 s on a mid-range phone,
              and that is what Google measures as the page's load time. */}
          <motion.p
            className="mt-6 max-w-[52ch] text-body leading-[1.625] text-mute md:mt-8"
            initial={{ y: reduced ? 0 : 16 }}
            animate={{ y: 0 }}
            transition={transition(intro.supporting, 1.1)}
          >
            {/* decodes itself on hover, word by word so the lines hold still */}
            <ScrambleText text={site.statement} wrap stagger={0.22} />
          </motion.p>

          <motion.div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10" {...appear(intro.cta)}>
            <Button href={site.resume} external cursor="view" cursorLabel="Open">
              View Resume
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

      <SocialRail />
      <ScrollCue />
    </section>
  );
}
