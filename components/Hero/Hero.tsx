import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { Ext } from "@/components/Section/Section";
import { linkClass as cta } from "@/components/Section/Parts";
import { site } from "@/lib/content";
import { SocialLinks } from "./SocialLinks";
import { ToolStrip } from "./ToolStrip";

/**
 * The reference's opening screen, typography first: the name in the left rail, a single headline and one
 * grey line in the wide column, then the tools I work in.
 */
export function Hero() {
  const headline = `${site.heroTitle.lead} ${site.heroTitle.mid} ${site.heroTitle.tail}`;
  return (
    <section id="home" aria-label="Introduction" className="gutter mx-auto max-w-[1920px] pb-24 pt-[calc(67px+clamp(120px,24svh,240px))] max-md:pt-[calc(67px+96px)]">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 lg:grid-cols-[28.5%_1fr]">
        <div className="text-[length:var(--text-ui)] leading-[1.7]">
          <p className="text-bone">{site.brand}</p>
          <p className="text-soft">{site.titles}</p>
          <p className="text-mute">{site.location}</p>
          <Reveal delay={0.85} className="mt-5">
            <SocialLinks />
          </Reveal>
        </div>
        <div>
          <Reveal delay={0.05}>
            <p className="label mb-3">{site.eyebrow}</p>
          </Reveal>
          <TextReveal
            as="h1"
            immediate
            delay={0.15}
            text={headline}
            className="max-w-[30ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone"
          />
          <Reveal delay={0.5}>
            <div className="mt-3 flex max-w-[56ch] flex-col gap-3 text-[length:var(--text-ui)] leading-[1.7] text-mute">
              {site.intro.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <dl className="mt-8 grid max-w-[640px] grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
              {site.highlights.map((h) => (
                <div key={h.value} className="border-t border-line pt-3">
                  <dt className="text-bone">{h.value}</dt>
                  <dd className="text-mute">{h.label}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--text-ui)] leading-[1.7]">
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
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-5 lg:grid-cols-[28.5%_1fr]">
        <div aria-hidden className="hidden lg:block" />
        <Reveal delay={0.7}>
          <ToolStrip />
        </Reveal>
      </div>
    </section>
  );
}
