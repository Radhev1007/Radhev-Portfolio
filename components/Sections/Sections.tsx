import { Reveal } from "@/components/Animations/Reveal";
import ScrollReveal from "@/components/ScrollReveal/ScrollReveal";
import { CopySection } from "@/components/Section/Parts";
import { Section } from "@/components/Section/Section";
import { ApproachList } from "./ApproachList";
import {
  about,
  aboutClosing,
  aboutSection,
  approach,
  approachSection,
} from "@/lib/content";

export function About() {
  return (
    <Section id="about" title={aboutSection.label}>
      {/* the headline reads itself in as you scroll (React Bits' ScrollReveal, with the usage example's settings) */}
      <ScrollReveal
        mode="scrub"
        splitBy="words"
        effect="fade"
        stagger={0.05}
        duration={0.8}
        smoothing={0}
        baseOpacity={0.1}
        baseRotation={3}
        baseOffset={0}
        enableBlur
        blurStrength={4}
        containerClassName="!mt-0 max-w-[28ch] text-[length:var(--text-h1)] text-bone"
        textClassName="!text-[length:var(--text-h1)] !font-normal !leading-[1.1] tracking-[-0.033em]"
      >
        {aboutSection.headline}
      </ScrollReveal>
      <div className="mt-14 flex max-w-[640px] flex-col gap-6 text-[length:var(--text-ui)] leading-[1.7] lg:mt-16">
        {about.map((para, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <p className={i === 0 ? "text-bone" : "text-soft"}>{para}</p>
          </Reveal>
        ))}
        <Reveal>
          <p className="mt-4 border-t border-line pt-5 text-mute">{aboutClosing}</p>
        </Reveal>
      </div>
    </Section>
  );
}

export function Approach() {
  return (
    <CopySection id="approach" copy={approachSection}>
      <ApproachList items={approach} />
    </CopySection>
  );
}
