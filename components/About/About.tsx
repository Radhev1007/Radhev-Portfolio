import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import { about } from "@/lib/content";

export function About() {
  return (
    <Section id="about" title="About">
      <div className="flex max-w-[640px] flex-col gap-4 text-[length:var(--text-ui)] leading-[1.7]">
        {about.map((para, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <p className={i === 0 ? "text-bone" : "text-soft"}>{para}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
