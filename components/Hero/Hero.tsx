import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
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
          <p className="text-mute">
            {site.location}
            {site.available && <span> · {site.availabilityLabel}</span>}
          </p>
          <Reveal delay={0.85} className="mt-5">
            <SocialLinks />
          </Reveal>
        </div>
        <div>
          <TextReveal
            as="h1"
            immediate
            delay={0.15}
            text={headline}
            className="max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone"
          />
          <Reveal delay={0.5}>
            <p className="mt-3 max-w-[56ch] text-[length:var(--text-ui)] leading-[1.7] text-mute">{site.intro}</p>
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
