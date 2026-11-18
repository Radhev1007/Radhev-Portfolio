import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import { focus } from "@/lib/content";

/** Three columns of plain lists under grey headings: no cards, no icons. */
export function Focus() {
  return (
    <Section id="focus" title="Focus">
      <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-3">
        {focus.map((group, i) => (
          <Reveal key={group.title} delay={i * 0.08}>
            <h3 className="label">{group.title}</h3>
            <ul className="mt-3 text-[length:var(--text-ui)] leading-[1.7] text-bone">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
