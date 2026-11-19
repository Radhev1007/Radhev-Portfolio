import { Reveal } from "@/components/Animations/Reveal";
import Magnet from "@/components/Magnet/Magnet";
import { TextReveal } from "@/components/Animations/TextReveal";
import { Ext } from "@/components/Section/Section";
import { linkClass as cta } from "@/components/Section/Parts";
import { site } from "@/lib/content";
import { Portrait } from "@/components/Sections/Portrait";
import { SocialLinks } from "./SocialLinks";
import { ToolStrip } from "./ToolStrip";

/**
 * The opening screen, typography first: the social links and portrait in the left rail, the headline, intro and
 * figures in the wide column, then the tools I work in. From desktop up it fills the viewport, and the portrait
 * and the tool strip both sit on its bottom edge.
 */
export function Hero() {
  return (
    <section
      id="home"
      aria-label="Introduction"
      className="gutter mx-auto flex max-w-[1920px] flex-col pb-16 pt-[calc(67px+48px)] lg:min-h-svh lg:pb-10 lg:pt-[calc(67px+clamp(64px,10svh,160px))]"
    >
      <div className="grid flex-1 grid-cols-1 gap-x-5 gap-y-10 lg:grid-cols-[28.5%_1fr] lg:grid-rows-[1fr_auto] lg:gap-y-16">
        {/* On phones this column dissolves into the grid so the headline comes straight after the
            icons, and the portrait drops below the tools instead of pushing the headline off the first screen. */}
        <div className="max-lg:contents lg:row-span-2 lg:flex lg:flex-col">
          <Reveal delay={0.85} className="max-lg:order-2">
            <SocialLinks />
          </Reveal>
          <Reveal delay={0.95} className="max-lg:order-5 max-lg:mt-4 lg:mt-auto lg:pt-10">
            <Portrait className="max-w-[240px] lg:max-w-[300px]" />
          </Reveal>
        </div>
        <div className="max-lg:order-3 max-lg:mt-4">
          <TextReveal
            as="h1"
            immediate
            delay={0.15}
            text={site.heroTitle.greeting}
            className="text-[clamp(2.5rem,5.5vw,4.75rem)] leading-[1.02] tracking-[-0.045em] text-bone"
          />
          <Reveal delay={0.35}>
            <p className="mt-4 max-w-[30ch] text-[clamp(1.375rem,2.4vw,2.25rem)] leading-[1.18] tracking-[-0.03em] text-soft lg:mt-5">
              {site.heroTitle.tagline}
            </p>
          </Reveal>
          <Reveal delay={0.5}>
            <div className="mt-7 flex max-w-[56ch] flex-col gap-5 lg:mt-6 lg:gap-4 text-[length:var(--text-ui)] leading-[1.7] text-mute">
              {site.intro.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <dl className="mt-14 grid max-w-[640px] lg:mt-12 grid-cols-2 gap-x-6 gap-y-8 lg:gap-x-5 lg:gap-y-6 sm:grid-cols-4">
              {site.highlights.map((h) => (
                <div key={h.value} className="border-t border-line pt-3">
                  <dt className="text-bone">{h.value}</dt>
                  <dd className="text-mute">{h.label}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 lg:mt-10 text-[length:var(--text-ui)] leading-[1.7]">
              <Magnet padding={100} magnetStrength={2}>
                <a href={`#${site.heroCtas.primary.target}`} className={cta}>
                  {site.heroCtas.primary.label}
                </a>
              </Magnet>
              <Magnet padding={100} magnetStrength={2}>
                <a href={site.resume} target="_blank" rel="noreferrer" className={cta}>
                  Download Resume
                  <Ext />
                </a>
              </Magnet>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.7} className="self-end max-lg:order-4 max-lg:mt-4">
          <ToolStrip />
        </Reveal>
      </div>
    </section>
  );
}
