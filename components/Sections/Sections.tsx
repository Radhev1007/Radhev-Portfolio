import { Reveal } from "@/components/Animations/Reveal";
import { CopySection, Lead, NumberedList } from "@/components/Section/Parts";
import {
  about,
  aboutClosing,
  aboutSection,
  approach,
  approachSection,
} from "@/lib/content";

export function About() {
  return (
    <CopySection id="about" copy={aboutSection}>
      <div className="flex max-w-[640px] flex-col gap-5 text-[length:var(--text-ui)] leading-[1.7]">
        {about.map((para, i) => (
          <Reveal key={i} delay={i * 0.05}>
            <p className={i === 0 ? "text-bone" : "text-soft"}>{para}</p>
          </Reveal>
        ))}
        <Reveal>
          <p className="mt-4 border-t border-line pt-5 text-mute">{aboutClosing}</p>
        </Reveal>
      </div>
    </CopySection>
  );
}

export function Approach() {
  return (
    <CopySection id="approach" copy={approachSection}>
      <NumberedList items={approach} />
    </CopySection>
  );
}
