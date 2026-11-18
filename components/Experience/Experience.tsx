import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import { experience } from "@/lib/content";

/** Recent engagements: organisation, role and period, as an aligned list. The dates are the ones on the CV. */
export function Experience() {
  return (
    <Section id="experience" title="Recent engagements">
      <Reveal>
        <ul className="text-[length:var(--text-ui)] leading-[1.7]">
          {experience.map((r) => (
            <li key={r.company} className="grid grid-cols-1 gap-x-5 border-t border-line py-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_10rem]">
              <span className="text-bone">{r.company}</span>
              <span className="text-soft">{r.title}</span>
              <span className="text-mute tabular-nums sm:text-right">
                {r.from} — {r.to}
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}
