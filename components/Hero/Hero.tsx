import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { Ext } from "@/components/Section/Section";
import { linkClass as cta } from "@/components/Section/Parts";
import { site } from "@/lib/content";
import { Portrait } from "@/components/Sections/Portrait";
import { SocialLinks } from "./SocialLinks";
import { ToolStrip } from "./ToolStrip";

/**
 * The opening screen, typography first: the name and portrait in the left rail, the headline, intro and
 * figures in the wide column, then the tools I work in. From desktop up it fills the viewport, and the portrait
 * and the tool strip both sit on its bottom edge.
 */
export function Hero() {
  const headline = `${site.heroTitle.lead} ${site.heroTitle.mid} ${site.heroTitle.tail}`;
  return (
    <section
      id="home"
      aria-label="Introduction"
      className="gutter mx-auto flex max-w-[1920px] flex-col pb-16 pt-[calc(67px+96px)] lg:min-h-svh lg:pb-10 lg:pt-[calc(67px+clamp(64px,10svh,160px))]"
    >
      <div className="grid flex-1 grid-cols-1 gap-x-5 gap-y-8 lg:grid-cols-[28.5%_1fr] lg:grid-rows-[1fr_auto] lg:gap-y-16">
        <div className="flex flex-col text-[length:var(--text-ui)] leading-[1.7] lg:row-span-2">
          <p className="text-bone">{site.brand}</p>
          <p className="text-soft">{site.titles}</p>
          <p className="text-mute">{site.location}</p>
          <Reveal delay={0.85} className="mt-5">
            <SocialLinks />
          </Reveal>
          <Reveal delay={0.95} className="mt-10 lg:mt-auto lg:pt-10">
            <Portrait className="max-w-[240px] lg:max-w-[300px]" />
          </Reveal>
        </div>
        <div>
          <Reveal delay={0.05}>
            <p className="label mb-5">{site.eyebrow}</p>
          </Reveal>
          <TextReveal
            as="h1"
            immediate
            delay={0.15}
            text={headline}
            className="max-w-[30ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone"
          />
          <Reveal delay={0.5}>
            <div className="mt-6 flex max-w-[56ch] flex-col gap-4 text-[length:var(--text-ui)] leading-[1.7] text-mute">
              {site.intro.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <dl className="mt-14 grid max-w-[640px] grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
              {site.highlights.map((h) => (
                <div key={h.value} className="border-t border-line pt-3">
                  <dt className="text-bone">{h.value}</dt>
                  <dd className="text-mute">{h.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-12 flex flex-wrap gap-x-8 gap-y-2 text-[length:var(--text-ui)] leading-[1.7]">
              <a href={`#${site.heroCtas.primary.target}`} className={cta}>
                {site.heroCtas.primary.label}
              </a>
              <a href={site.resume} target="_blank" rel="noreferrer" className={cta}>
                Download Resume
                <Ext />
              </a>
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.7} className="mt-8 self-end lg:mt-0">
          <ToolStrip />
        </Reveal>
      </div>
    </section>
  );
}
